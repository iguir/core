import { Hono } from 'hono'
import type { AclRegistry } from '../acl/registry'
import { aclContext } from '../acl/middleware'
import type { ModuleRegistry } from '../module/registry'
import type { ModuleLogger } from '../module/types'
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
 *   1. Install the global ACL context middleware (every request gets `c.var.can`).
 *   2. For each module, mount its API routes under the declared prefix.
 *   3. Register subscriptions on the event bus.
 *
 * Returns the assembled Hono instance, ready for `serve()` to take over.
 *
 * NOTE: Step 4 (routing) and Step 5 (events) of the build order own the
 *       concrete `defineRoutes` / event-bus wiring. Until those land, this
 *       function fails loudly if a module declares routes, subscriptions, or
 *       pages — there is no quiet "we'll figure it out later" path.
 */
export function mount(deps: MountDeps): Hono {
    const { registry, acl, logger } = deps
    const app = new Hono()

    // 1. Per-request ACL checker. The app is expected to install its auth
    //    middleware separately; `aclContext` just reads `c.var.user`.
    app.use('*', aclContext({ registry: acl }))

    // 2. Detect modules that declare features the bootstrap can't wire yet.
    for (const m of registry.inBootOrder()) {
        if (m.routes) {
            throw new Error(
                `[module:${m.name}] declares \`routes\` but the routing layer ` +
                    'is not yet wired into bootstrap. This will land in Step 4 ' +
                    '(src/routing/code.ts).',
            )
        }
        if (m.subscriptions) {
            throw new Error(
                `[module:${m.name}] declares \`subscriptions\` but the event bus ` +
                    'is not yet wired into bootstrap. This will land in Step 5 ' +
                    '(src/events/*).',
            )
        }
        if (m.pages) {
            throw new Error(
                `[module:${m.name}] declares \`pages\` but the file-route ` +
                    'consumer is not yet wired into bootstrap. This will land ' +
                    'in Step 7 (src/routing/file.ts, src/jsx/*).',
            )
        }
    }

    logger.debug(
        { modules: registry.allModuleNames() },
        'mount: ACL middleware installed; routes/events/pages pending Steps 4-7',
    )

    return app
}
