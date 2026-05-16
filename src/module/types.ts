import type { MiddlewareHandler } from 'hono'
import type { z } from 'zod'
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

/**
 * The runtime shape of a contract: each method becomes an async function whose
 * input/output types are inferred from the contract's Zod schemas. This is what
 * a module's `implementation` factory must return, and what callers see when
 * they reach into `ctx.services.<name>`.
 */
export type Implementation<TContract extends ModuleContract> = {
    [K in keyof TContract['methods']]: (
        input: z.infer<TContract['methods'][K]['input']>,
    ) =>
        | z.infer<TContract['methods'][K]['output']>
        | Promise<z.infer<TContract['methods'][K]['output']>>
}

/**
 * Services map seen by an implementation factory or `onBoot`. Keyed by
 * contract name, typed against each imported contract.
 */
export type ServicesOf<TImports extends readonly ModuleContract[]> = {
    [TContract in TImports[number] as TContract['name']]: Implementation<TContract>
}

/** Context passed to the `implementation` factory. */
export interface ImplementationContext<
    TImports extends readonly ModuleContract[] = readonly ModuleContract[],
> {
    /** Logger pre-bound with `{ module: <name> }`. */
    logger: ModuleLogger
    /** Resolved services for every contract this module imports. */
    services: ServicesOf<TImports>
}

/** Factory that builds a module's runtime implementation. */
export type ImplementationFactory<
    TProvides extends ModuleContract,
    TImports extends readonly ModuleContract[],
> = (
    ctx: ImplementationContext<TImports>,
) => Implementation<TProvides> | Promise<Implementation<TProvides>>

/**
 * Opaque event-bus marker type. The concrete `EventBus` interface lives in
 * `src/events/bus.ts`; module-layer types only need to thread it through.
 * Re-typed here to avoid a circular import with the events package.
 */
export interface ModuleBus {
    publish(event: unknown, payload: unknown): Promise<void>
    subscribe(event: unknown, handler: (payload: unknown) => unknown): () => void
    register(definition: unknown): void
    registerAll(defined: unknown): void
    registeredEvents(): readonly string[]
}

/** Context delivered to `onBoot`. Built once at bootstrap, never mutated. */
export interface ModuleBootContext<
    TImports extends readonly ModuleContract[] = readonly ModuleContract[],
> {
    /** Logger pre-bound with `{ module: <name> }`. */
    logger: ModuleLogger
    /** Resolved services for every contract this module imports. */
    services: ServicesOf<TImports>
    /** The live event bus the rest of the app is using. */
    bus: ModuleBus
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
    /**
     * Required when `provides` is set: the factory that builds the runtime
     * implementation of this module's contract. Called once at bootstrap, in
     * dependency-first order, with `logger` and the resolved `services` for
     * every contract this module imports.
     */
    readonly implementation?: TProvides extends ModuleContract
        ? ImplementationFactory<TProvides, TImports>
        : never
    readonly acl?: AclSpec
    readonly events?: ModuleEvents
    readonly routes?: ModuleApiRoutes
    readonly pages?: ModulePages
    /**
     * Middleware run by `bootstrap()` BEFORE `aclContext` and before any
     * module routes are mounted. The canonical use case is session/auth
     * middleware that populates `c.var.user` — `aclContext` then builds the
     * checker from that user. Use sparingly: most modules want route-level
     * middleware via `defineRoutes`, not global.
     */
    readonly globalMiddleware?: readonly MiddlewareHandler[]
    readonly subscriptions?: ModuleSubscriptions
    readonly onBoot?: (ctx: ModuleBootContext<TImports>) => void | Promise<void>
    readonly onShutdown?: () => void | Promise<void>
}
