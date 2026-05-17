import type { Context } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { defineRoutes } from '../routing/code'
import {
    ConflictError,
    UnauthorizedError,
    BadRequestError,
} from '../errors/index'
import type { EventBus } from '../events/bus'
import type { ModuleLogger } from '../module/types'
import { authEvents } from './events'
import { LoginInputSchema, RegisterInputSchema } from './contract'
import type { SessionStore, UserStore } from './store'
import { toPublicUser } from './types'

/** Mutable refs the auth routes read at request time. */
export interface AuthRoutesDeps {
    userStore: UserStore
    sessionStore: SessionStore
    /** Read fresh on every request — `onBoot` swaps in the live bus. */
    busRef: { current: EventBus }
    loggerRef: { current: ModuleLogger }
    cookieName: string
    cookieSecure: boolean
    sessionTtlMs: number
}

/**
 * The auth module's HTTP surface:
 *   POST /register   — create a new user + start a session
 *   POST /login      — verify credentials + start a session
 *   POST /logout     — invalidate the current session (idempotent)
 *   GET  /me         — return the authenticated user, or 401
 */
export function createAuthRoutes(deps: AuthRoutesDeps) {
    return defineRoutes(({ r }) => {
        r.post('/register', { body: RegisterInputSchema }, async (c) => {
            const input = c.req.valid('json')

            const existing = await deps.userStore.findByEmail(input.email)
            if (existing) {
                throw new ConflictError('Email already in use', { email: input.email })
            }

            const passwordHash = await Bun.password.hash(input.password)
            const user = await deps.userStore.create({
                email: input.email,
                passwordHash,
                roles: input.roles,
            })

            const session = await deps.sessionStore.create(user.id, deps.sessionTtlMs)
            attachSessionCookie(c as unknown as Context, deps, session.id)

            const publicUser = toPublicUser(user)
            await deps.busRef.current.publish(
                authEvents.events['auth.user.registered'],
                publicUser,
            )
            return c.json(publicUser, 201)
        })

        r.post('/login', { body: LoginInputSchema }, async (c) => {
            const { email, password } = c.req.valid('json')

            const user = await deps.userStore.findByEmail(email)
            if (!user) throw new UnauthorizedError('Invalid email or password')

            const ok = await Bun.password.verify(password, user.passwordHash)
            if (!ok) throw new UnauthorizedError('Invalid email or password')

            const session = await deps.sessionStore.create(user.id, deps.sessionTtlMs)
            attachSessionCookie(c as unknown as Context, deps, session.id)

            await deps.busRef.current.publish(
                authEvents.events['auth.user.logged_in'],
                { userId: user.id, sessionId: session.id },
            )
            return c.json(toPublicUser(user))
        })

        r.post('/logout', {}, async (c) => {
            const cookie = c.req.header('cookie') ?? ''
            const match = new RegExp(`(?:^|;\\s*)${escapeRe(deps.cookieName)}=([^;]+)`)
                .exec(cookie)
            const sessionId = match?.[1]

            if (sessionId) {
                const session = await deps.sessionStore.findById(sessionId)
                await deps.sessionStore.delete(sessionId)
                if (session) {
                    await deps.busRef.current.publish(
                        authEvents.events['auth.user.logged_out'],
                        { userId: session.userId, sessionId: session.id },
                    )
                }
            }

            deleteCookie(c as unknown as Context, deps.cookieName, { path: '/' })
            return c.body(null, 204)
        })

        r.get('/me', { auth: true }, async (c) => {
            const subject = c.get('user')
            if (!subject || !subject.id) {
                throw new BadRequestError(
                    'session user missing id — auth middleware misconfigured?',
                )
            }
            const user = await deps.userStore.findById(subject.id)
            if (!user) throw new UnauthorizedError()
            return c.json(toPublicUser(user))
        })
    })
}

function attachSessionCookie(
    c: Context,
    deps: AuthRoutesDeps,
    sessionId: string,
) {
    setCookie(c, deps.cookieName, sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: deps.cookieSecure,
        maxAge: Math.floor(deps.sessionTtlMs / 1000),
    })
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
