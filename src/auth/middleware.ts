import { type MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { ModuleLogger } from '../module/types'
import type { SessionStore, UserStore } from './store'

/** Options for `createSessionMiddleware`. */
export interface SessionMiddlewareOptions {
    cookieName: string
    sessionStore: SessionStore
    userStore: UserStore
    logger: ModuleLogger
}

/**
 * Reads the session cookie, resolves it to a user via the stores, and sets
 * `c.var.user` so `aclContext` (which runs next) builds a checker for that
 * subject.
 *
 * Designed to be the only thing standing between the wire and `aclContext`.
 * If anything fails we set NO user — the request continues as anonymous, and
 * any `auth: true` route returns 401 from `requirePermission`.
 */
export function createSessionMiddleware(
    opts: SessionMiddlewareOptions,
): MiddlewareHandler {
    const { cookieName, sessionStore, userStore, logger } = opts
    return async (c, next) => {
        const sessionId = getCookie(c, cookieName)
        if (!sessionId) {
            await next()
            return
        }

        try {
            const session = await sessionStore.findById(sessionId)
            if (!session) {
                await next()
                return
            }
            const user = await userStore.findById(session.userId)
            if (!user) {
                // Orphan session — drop it.
                await sessionStore.delete(sessionId)
                await next()
                return
            }
            c.set('user', {
                id: user.id,
                roles: user.roles,
                permissionGrants: user.permissionGrants,
                permissionDenies: user.permissionDenies,
            })
        } catch (err) {
            logger.error(
                { err, cookieName },
                '[auth] session lookup failed — proceeding as anonymous',
            )
        }
        await next()
    }
}
