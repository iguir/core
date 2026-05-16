import type { Hono } from 'hono'
import { AclRegistry } from '../acl/registry'
import type { AclSpec, Roles } from '../acl/types'
import { ModuleRegistry } from '../module/registry'
import type { ModuleLogger, ModuleSpec } from '../module/types'
import { Lifecycle } from './lifecycle'
import { mount } from './mount'
import { resolveServices, type ServiceRegistry } from './resolve'

/** Minimum config the bootstrapper needs. Wider config lives in `src/config.ts`. */
export interface BootstrapConfig {
    roles: Roles
    modules: readonly ModuleSpec[]
    /** Optional logger override. Defaults to a console-backed stub until `@app/logger` lands. */
    logger?: ModuleLogger
}

/** What `bootstrap()` returns — every layer is reachable for tests + the CLI. */
export interface BootstrappedApp {
    app: Hono
    lifecycle: Lifecycle
    services: ServiceRegistry
    modules: ModuleRegistry
    acl: AclRegistry
    logger: ModuleLogger
}

/**
 * The public entry. Validates everything, wires the layers in dependency
 * order, calls `onBoot` for each module, and hands back a ready-to-serve
 * Hono app.
 *
 *   const { app, lifecycle } = await bootstrap(config)
 *   serve(app, config.server)
 *   lifecycle.installSignalHandlers()
 *
 * Throws on any validation failure with an actionable `[module:name]` /
 * `[acl:name]` tag. Failed `onBoot` rolls back booted modules before
 * re-throwing.
 */
export async function bootstrap(
    config: BootstrapConfig,
): Promise<BootstrappedApp> {
    const logger = config.logger ?? createDefaultLogger()

    // 1. ACL registry — built from app roles + each module's optional ACL spec.
    const moduleAcls = config.modules
        .map((m) => m.acl)
        .filter((acl): acl is AclSpec => acl !== undefined)
    const acl = new AclRegistry(config.roles, moduleAcls)

    // 2. Module registry — name dedup, satisfied imports, topo sort.
    const modules = new ModuleRegistry(config.modules)

    // 3. Resolve implementations in topo order; each factory sees its imports.
    const services = await resolveServices(modules, { logger })

    // 4. Build the Hono app: global ACL middleware + (eventually) routes.
    const app = mount({ registry: modules, services, acl, logger })

    // 5. Lifecycle controller — runs onBoot now, runs onShutdown on signal.
    const lifecycle = new Lifecycle({ registry: modules, services, logger })
    await lifecycle.boot()

    return { app, lifecycle, services, modules, acl, logger }
}

/**
 * Console-backed structural logger. Used until `@app/logger` (Pino) lands so
 * tests and early consumers don't have to inject one by hand. Drop-in
 * replaceable with `pino()` later — same surface.
 */
function createDefaultLogger(): ModuleLogger {
    const bindings: Record<string, unknown> = {}
    const make = (b: Record<string, unknown>): ModuleLogger => {
        const tag = formatBindings(b)
        return {
            info: (...args) => console.log(tag, ...args),
            warn: (...args) => console.warn(tag, ...args),
            error: (...args) => console.error(tag, ...args),
            debug: (...args) => {
                if (process.env.DEBUG) console.debug(tag, ...args)
            },
            child: (more) => make({ ...b, ...more }),
        }
    }
    return make(bindings)
}

function formatBindings(b: Record<string, unknown>): string {
    const entries = Object.entries(b)
    if (entries.length === 0) return '[app]'
    return `[${entries.map(([k, v]) => `${k}=${String(v)}`).join(' ')}]`
}
