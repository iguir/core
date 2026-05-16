/**
 * `@iguir/auth` — first-party auth module (currently colocated in `src/auth/`,
 * will move to `packages/auth` on monorepo split).
 *
 * Dogfoods every framework primitive: `defineModule`, `defineContract`,
 * `defineAcl`, `defineEvents`, `defineRoutes`, `globalMiddleware`, `onBoot`.
 *
 *   const auth = createAuthModule({
 *     userStore:    new MemoryUserStore(),
 *     sessionStore: new MemorySessionStore(),
 *   })
 *
 *   defineConfig({ roles, modules: [auth, ...] })
 */

import { defineModule } from '../module/define'
import type { EventBus } from '../events/bus'
import { InMemoryEventBus } from '../events/memory'
import type { ModuleBus, ModuleLogger } from '../module/types'
import { authContract } from './contract'
import { authAcl } from './acl'
import { authEvents } from './events'
import { createSessionMiddleware } from './middleware'
import { createAuthRoutes } from './routes'
import {
    MemorySessionStore,
    MemoryUserStore,
    type SessionStore,
    type UserStore,
} from './store'
import { toPublicUser } from './types'

/** User-facing options for `createAuthModule()`. */
export interface CreateAuthModuleOptions {
    userStore: UserStore
    sessionStore: SessionStore
    /** Cookie name. Defaults to `app_session`. */
    cookieName?: string
    /**
     * Whether to mark the session cookie `Secure`. Defaults to
     * `NODE_ENV === 'production'`. Set to `false` for local HTTP dev.
     */
    cookieSecure?: boolean
    /** Session TTL in milliseconds. Defaults to 30 days. */
    sessionTtlMs?: number
    /** Where to mount the auth routes. Defaults to `/auth`. */
    prefix?: string
}

/**
 * Build the auth module. Returned value is a regular `defineModule(...)`
 * result and plugs into `defineConfig({ modules: [...] })`.
 */
export function createAuthModule(opts: CreateAuthModuleOptions) {
    const cookieName = opts.cookieName ?? 'app_session'
    const cookieSecure = opts.cookieSecure ?? process.env.NODE_ENV === 'production'
    const sessionTtlMs = opts.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000
    const prefix = opts.prefix ?? '/auth'

    // Refs swapped by onBoot once the live bus + logger are available.
    // Until then, publishes go to a silent fallback bus.
    const fallbackBus: EventBus = new InMemoryEventBus({ logger: silentLogger() })
    const busRef: { current: EventBus } = { current: fallbackBus }
    const loggerRef: { current: ModuleLogger } = { current: silentLogger() }

    const routes = createAuthRoutes({
        userStore: opts.userStore,
        sessionStore: opts.sessionStore,
        busRef,
        loggerRef,
        cookieName,
        cookieSecure,
        sessionTtlMs,
    })

    return defineModule({
        name: 'auth',
        provides: authContract,
        acl: authAcl,
        events: authEvents,
        implementation: ({ logger }) => ({
            async findUserById({ id }) {
                const u = await opts.userStore.findById(id)
                return u ? toPublicUser(u) : null
            },
            async findUserByEmail({ email }) {
                const u = await opts.userStore.findByEmail(email)
                return u ? toPublicUser(u) : null
            },
            async registerUser(input) {
                const existing = await opts.userStore.findByEmail(input.email)
                if (existing) {
                    throw new Error(`[auth] email "${input.email}" already in use`)
                }
                const passwordHash = await Bun.password.hash(input.password)
                const user = await opts.userStore.create({
                    email: input.email,
                    passwordHash,
                    roles: input.roles,
                })
                const pub = toPublicUser(user)
                await busRef.current.publish(
                    authEvents.events['auth.user.registered'],
                    pub,
                )
                logger.info({ userId: user.id }, 'user registered')
                return pub
            },
            async verifyPassword({ email, password }) {
                const u = await opts.userStore.findByEmail(email)
                if (!u) return null
                const ok = await Bun.password.verify(password, u.passwordHash)
                return ok ? toPublicUser(u) : null
            },
        }),
        globalMiddleware: [
            createSessionMiddleware({
                cookieName,
                sessionStore: opts.sessionStore,
                userStore: opts.userStore,
                logger: silentLogger(),
            }),
        ],
        routes: { handler: routes, prefix },
        onBoot: ({ logger, bus }) => {
            // Swap the silent fallback for the real app-wide bus + logger.
            busRef.current = bus as unknown as EventBus
            loggerRef.current = logger
        },
    })
}

function silentLogger(): ModuleLogger {
    const fn = () => {}
    const logger: ModuleLogger = {
        info: fn,
        warn: fn,
        error: fn,
        debug: fn,
        child: () => logger,
    }
    return logger
}

// Re-exports for downstream code.
export { MemoryUserStore, MemorySessionStore } from './store'
export type { UserStore, SessionStore } from './store'
export { authContract, type AuthContract } from './contract'
export { authAcl } from './acl'
export { authEvents } from './events'
export type { AuthUser, PublicUser, Session } from './types'
export { toPublicUser } from './types'
