import type { AclSpec } from '../acl/types'
import type { ModuleContract } from './contract'

/**
 * Minimal structural logger — pino's Logger satisfies this. Defined here so
 * the module layer doesn't have to import pino directly (keeps Step 1
 * type-only, with no runtime dependencies beyond Hono and Zod).
 */
export interface ModuleLogger {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    debug(...args: unknown[]): void
    child(bindings: Record<string, unknown>): ModuleLogger
}

/**
 * Opaque routes value returned by `defineRoutes()`. The concrete shape is owned
 * by `src/routing/code.ts`; module-layer code only needs to thread it through.
 */
export interface ModuleRoutes {
    readonly __kind: 'app:routes'
}

/**
 * Opaque events declaration returned by `defineEvents()`. The concrete shape is
 * owned by `src/events/define.ts`.
 */
export interface ModuleEvents {
    readonly __kind: 'app:events'
}

/** API route mount configuration on a module. */
export interface ModuleApiRoutes {
    handler: ModuleRoutes
    prefix?: string
}

/** Page routes mount configuration on a module. */
export interface ModulePages {
    dir: string
    prefix?: string
}

/** Subscription handler signature for in-process events. */
export type SubscriptionHandler<TPayload = unknown> = (
    payload: TPayload,
) => void | Promise<void>

/** Map of event name → handler for a module's subscriptions. */
export type ModuleSubscriptions = Record<string, SubscriptionHandler>

/** Context delivered to `onBoot`. Built once at bootstrap, never mutated. */
export interface ModuleBootContext {
    /** Logger pre-bound with `{ module: <name> }`. */
    logger: ModuleLogger
    /** Resolved providers — keyed by contract name. */
    providers: Readonly<Record<string, ModuleContract['methods']>>
}

/** Validated module definition stored in the registry. */
export interface ModuleSpec<
    TName extends string = string,
    TImports extends readonly ModuleContract[] = readonly ModuleContract[],
    TProvides extends ModuleContract | undefined = ModuleContract | undefined,
> {
    readonly name: TName
    readonly imports?: TImports
    readonly provides?: TProvides
    readonly acl?: AclSpec
    readonly events?: ModuleEvents
    readonly routes?: ModuleApiRoutes
    readonly pages?: ModulePages
    readonly subscriptions?: ModuleSubscriptions
    readonly onBoot?: (ctx: ModuleBootContext) => void | Promise<void>
    readonly onShutdown?: () => void | Promise<void>
}
