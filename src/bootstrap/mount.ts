import { Hono } from 'hono'
import type { AclRegistry } from '../acl/registry'
import { aclContext } from '../acl/middleware'
import { createErrorHandler } from '../errors/handler'
import type { ModuleContract } from '../module/contract'
import type { ModuleRegistry } from '../module/registry'
import type { ModuleLogger, ServicesOf } from '../module/types'
import type { DefinedRoutes } from '../routing/code'
import type { ServiceRegistry } from './resolve'

/** Dependencies needed to assemble the Hono app. */
export interface MountDeps {
    registry: ModuleRegistry
    services: ServiceRegistry
    acl: AclRegistry
    logger: ModuleLogger
}

/**
 * Build the Hono application:
 *   1. Register the global error handler (AppError / ZodError / HTTPException).
 *   2. Install the global ACL context middleware (`c.var.can` per request).
 *   3. Mount each module's API routes under its declared prefix.
 *
 * Subscriptions (Step 5 — events) and pages (Step 7 — file routing) are still
 * detected and rejected with an actionable error until those layers land.
 */
export async function mount(deps: MountDeps): Promise<Hono> {
    const { registry, services, acl, logger } = deps
    const app = new Hono()

    app.onError(createErrorHandler({ logger }))

    app.use('*', aclContext({ registry: acl }))

    for (const m of registry.inBootOrder()) {
        // Subscriptions are wired in bootstrap/index.ts after the bus is built;
        // mount.ts only deals with HTTP-side wiring.
        if (m.pages) {
            throw new Error(
                `[module:${m.name}] declares \`pages\` but the file-route ` +
                    'consumer is not yet wired into bootstrap. This will land ' +
                    'in Step 7 (src/routing/file.ts, src/jsx/*).',
            )
        }

        if (!m.routes) continue

        const routes = m.routes.handler as unknown as DefinedRoutes
        if (routes.__kind !== 'app:routes' || typeof routes.build !== 'function') {
            throw new Error(
                `[module:${m.name}] routes.handler must be the result of defineRoutes()`,
            )
        }

        const imports = (m.imports as readonly ModuleContract[] | undefined) ?? []
        const picked = services.pickFor(imports) as unknown as ServicesOf<
            readonly ModuleContract[]
        >
        const sub = await routes.build(picked)
        app.route(m.routes.prefix ?? '/', sub)
    }

    logger.debug(
        { modules: registry.allModuleNames() },
        'mount: ACL + error handler installed; routes mounted',
    )

    return app
}
