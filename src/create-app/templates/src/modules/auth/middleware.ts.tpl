import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { AuthService } from './services/index'

export interface SessionMiddlewareOptions {
    cookieName: string
    service: AuthService
}

/**
 * Reads the session cookie, resolves it to a user, and sets `c.var.user`.
 *
 * Mounted as the auth module's `globalMiddleware` so it runs BEFORE
 * `aclContext` — every permission check then sees the resolved subject.
 * If anything fails we just don't set the user, and any `auth: true` route
 * returns 401 from `requirePermission`.
 */
export function createSessionMiddleware(
    opts: SessionMiddlewareOptions,
): MiddlewareHandler {
    return async (c, next) => {
        const sessionId = getCookie(c, opts.cookieName)
        if (!sessionId) {
            await next()
            return
        }

        try {
            const session = await opts.service.findSession(sessionId)
            if (!session) {
                await next()
                return
            }
            const user = await opts.service.findUserById(session.userId)
            if (!user) {
                await opts.service.deleteSession(sessionId)
                await next()
                return
            }
            c.set('user', {
                id: user.id,
                roles: user.roles,
                permissionGrants: user.permissionGrants ?? undefined,
                permissionDenies: user.permissionDenies ?? undefined,
            })
        } catch (err) {
            // Don't leak DB errors as 500s on every request. Logging + anonymous
            // proceed is the safer default.
            c.get('logger')?.error?.(
                { err },
                '[auth] session lookup failed; proceeding as anonymous',
            )
        }
        await next()
    }
}
