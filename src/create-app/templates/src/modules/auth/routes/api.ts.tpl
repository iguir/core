import type { Context } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import {
    BadRequestError,
    ConflictError,
    defineRoutes,
    UnauthorizedError,
} from '@iguir/core'
import {
    LoginInputSchema,
    RegisterInputSchema,
} from './../auth.contract'
import { authEvents } from './../events'
import type { AuthService } from './../services/index'
import { toPublicUser } from './../services/index'

interface RouteDeps {
    service: AuthService
    cookieName: string
    cookieSecure: boolean
    sessionTtlMs: number
    publish: (event: unknown, payload: unknown) => Promise<void>
}

export function createApiRoutes(deps: RouteDeps) {
    return defineRoutes(({ r }) => {
        r.post('/register', { body: RegisterInputSchema }, async (c) => {
            const input = c.req.valid('json')

            const existing = await deps.service.findUserByEmail(input.email)
            if (existing) {
                throw new ConflictError('Email already in use', { email: input.email })
            }

            const user = await deps.service.createUser({
                email: input.email,
                password: input.password,
                roles: input.roles,
            })
            const session = await deps.service.createSession(
                user.id,
                deps.sessionTtlMs,
            )
            attachSessionCookie(c as unknown as Context, deps, session.id)

            const publicUser = toPublicUser(user)
            await deps.publish(authEvents.events['auth.user.registered'], publicUser)
            return c.json(publicUser, 201)
        })

        r.post('/login', { body: LoginInputSchema }, async (c) => {
            const { email, password } = c.req.valid('json')
            const user = await deps.service.verifyPassword(email, password)
            if (!user) throw new UnauthorizedError('Invalid email or password')

            const session = await deps.service.createSession(
                user.id,
                deps.sessionTtlMs,
            )
            attachSessionCookie(c as unknown as Context, deps, session.id)

            await deps.publish(authEvents.events['auth.user.logged_in'], {
                userId: user.id,
                sessionId: session.id,
            })
            return c.json(toPublicUser(user))
        })

        r.post('/logout', {}, async (c) => {
            const cookieHeader = c.req.header('cookie') ?? ''
            const match = new RegExp(
                `(?:^|;\\s*)${escapeRe(deps.cookieName)}=([^;]+)`,
            ).exec(cookieHeader)
            const sessionId = match?.[1]

            if (sessionId) {
                const session = await deps.service.findSession(sessionId)
                await deps.service.deleteSession(sessionId)
                if (session) {
                    await deps.publish(authEvents.events['auth.user.logged_out'], {
                        userId: session.userId,
                        sessionId: session.id,
                    })
                }
            }
            deleteCookie(c as unknown as Context, deps.cookieName, { path: '/' })
            return c.body(null, 204)
        })

        r.get('/me', { auth: true }, async (c) => {
            const subject = c.get('user')
            if (!subject?.id) {
                throw new BadRequestError(
                    'session user missing id — middleware misconfigured?',
                )
            }
            const user = await deps.service.findUserById(subject.id)
            if (!user) throw new UnauthorizedError()
            return c.json(toPublicUser(user))
        })
    })
}

function attachSessionCookie(
    c: Context,
    deps: RouteDeps,
    sessionId: string,
): void {
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
