import type { TLSOptions } from 'bun'
import type { Roles } from './acl/types'
import type { EventBus } from './events/bus'
import type { ModuleLogger, ModuleSpec } from './module/types'

/** Server-side networking configuration for `Bun.serve`. */
export interface ServerConfig {
    port: number
    /**
     * Bind address. `'0.0.0.0'` exposes the server outside the host (useful
     * for containers and LAN dev); `'localhost'` / `'127.0.0.1'` are loopback-only.
     */
    hostName?: '0.0.0.0' | 'localhost' | '127.0.0.1'
    /** TLS settings — when set, the server runs HTTPS. */
    tls?: TLSOptions
}

/**
 * The full application configuration produced by `defineConfig()` and
 * consumed by `bootstrap()` + `serve()`. Wider than `BootstrapConfig` so the
 * CLI + `serve()` can read everything from one source of truth.
 */
export interface AppConfig {
    /** 'development' | 'production' | 'test'. Defaults to 'development'. */
    environment: 'development' | 'production' | 'test'
    /** App-wide role registry — usually the result of `defineRoles({...})`. */
    roles: Roles
    /** Every module the app should mount. */
    modules: readonly ModuleSpec[]
    /** Server bind / TLS settings. */
    server: ServerConfig
    /** Optional logger override (defaults to console-backed in bootstrap). */
    logger?: ModuleLogger
    /** Optional event-bus override (defaults to in-memory). */
    eventBus?: EventBus
}