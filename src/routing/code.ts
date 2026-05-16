import { Hono, type Context, type Handler, type MiddlewareHandler } from 'hono'
import type { ZodType, z } from 'zod'
import type { ModuleContract } from '../module/contract'
import type { ServicesOf } from '../module/types'
import { requirePermission } from '../acl/middleware'
import { validatorsFor, type RouteValidators } from '../validation/zod'

/** HTTP verbs supported by the `r` builder. Mirrors Hono's surface. */
type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options'

/** Options accepted by every `r.<verb>(path, options, handler)` call. */
export interface RouteOptions extends RouteValidators {
    /** Require an authenticated user. Defaults to `false` (public). */
    auth?: boolean
    /** ACL permission required to call this route. Implies `auth: true`. */
    permission?: string
    /**
     * Resource-level check. Runs after the permission check; returning `false`
     * yields a 403. Useful for "user can update their own posts" rules.
     */
    condition?: (c: Context) => boolean | Promise<boolean>
}

/**
 * Public Variable map produced by a route's validators. Lets the typed handler
 * read parsed input via `c.req.valid('json' | 'query' | 'param' | 'header')`.
 */
type ValidatedFor<TOptions extends RouteOptions> = {
    json: TOptions['body'] extends ZodType ? z.infer<TOptions['body']> : never
    query: TOptions['query'] extends ZodType ? z.infer<TOptions['query']> : never
    param: TOptions['param'] extends ZodType ? z.infer<TOptions['param']> : never
    header: TOptions['header'] extends ZodType ? z.infer<TOptions['header']> : never
}

/**
 * Handler shape for a single route. The typed `c.req.valid(target)` is wired
 * by Hono's `validator` middleware at runtime; in user code this widens to
 * `unknown` unless the user pins the schema type — a downstream refinement
 * we'll add when the `r` builder gets full validator-type threading.
 */
export type RouteHandler<TOptions extends RouteOptions = RouteOptions> = (
    c: Context,
) => Response | Promise<Response>

// Reserved for the type-threading refinement noted on RouteHandler.
type _ValidatedFor<TOptions extends RouteOptions> = ValidatedFor<TOptions>

/** The `r` builder users see inside their `defineRoutes(...)` callback. */
export interface R {
    get<const TOptions extends RouteOptions>(
        path: string,
        options: TOptions,
        handler: RouteHandler<TOptions>,
    ): R
    post<const TOptions extends RouteOptions>(
        path: string,
        options: TOptions,
        handler: RouteHandler<TOptions>,
    ): R
    put<const TOptions extends RouteOptions>(
        path: string,
        options: TOptions,
        handler: RouteHandler<TOptions>,
    ): R
    patch<const TOptions extends RouteOptions>(
        path: string,
        options: TOptions,
        handler: RouteHandler<TOptions>,
    ): R
    delete<const TOptions extends RouteOptions>(
        path: string,
        options: TOptions,
        handler: RouteHandler<TOptions>,
    ): R
    options<const TOptions extends RouteOptions>(
        path: string,
        options: TOptions,
        handler: RouteHandler<TOptions>,
    ): R
    /** Escape hatch — drop down to the underlying Hono instance. */
    raw(): Hono
}

/** Context passed to the `defineRoutes` callback. */
export interface RoutesContext<
    TImports extends readonly ModuleContract[] = readonly ModuleContract[],
> {
    r: R
    services: ServicesOf<TImports>
}

/** Builder function the user passes to `defineRoutes`. */
export type RoutesBuilder<
    TImports extends readonly ModuleContract[] = readonly ModuleContract[],
> = (ctx: RoutesContext<TImports>) => void | Promise<void>

/**
 * Returned by `defineRoutes` and stored on `module.routes.handler`. Mounted by
 * `bootstrap/mount.ts`, which calls `build(services)` once the providers have
 * been resolved.
 */
export interface DefinedRoutes {
    readonly __kind: 'app:routes'
    /** Internal: assemble the Hono sub-app with the resolved services injected. */
    build(services: ServicesOf<readonly ModuleContract[]>): Hono | Promise<Hono>
    /** Introspection: the routes declared, for `iguir routes` CLI + OpenAPI gen. */
    readonly declared: readonly DeclaredRoute[]
}

/** A single route as declared by the user — surfaced for introspection. */
export interface DeclaredRoute {
    method: Verb
    path: string
    options: RouteOptions
}

/**
 * Declare a module's API routes in code (the explicit, refactor-safe half of
 * the hybrid routing story — file routes own pages).
 *
 *   export const apiRoutes = defineRoutes(({ r, services }) => {
 *     r.get('/', { auth: true, permission: 'posts.list' }, (c) => c.json([]))
 *     r.post('/',
 *       { auth: true, permission: 'posts.create', body: PostSchema },
 *       async (c) => {
 *         const data = c.req.valid('json')
 *         const created = await services.posts.create(data)
 *         return c.json(created, 201)
 *       },
 *     )
 *   })
 *
 * The callback is deferred — it runs once at bootstrap with the resolved
 * service registry. This is what makes `services.users.findById(...)` typed.
 */
export function defineRoutes<
    const TImports extends readonly ModuleContract[] = readonly ModuleContract[],
>(builder: RoutesBuilder<TImports>): DefinedRoutes {
    if (typeof builder !== 'function') {
        throw new TypeError(
            '[routes] defineRoutes: argument must be a builder function',
        )
    }

    // We collect the declared routes eagerly via a dry-run builder so that
    // CLI introspection + OpenAPI generation work without booting the app.
    const declared: DeclaredRoute[] = []

    return Object.freeze({
        __kind: 'app:routes' as const,
        declared,
        async build(services: ServicesOf<readonly ModuleContract[]>) {
            const app = new Hono()
            const r = createBuilder(app, declared)
            await builder({
                r,
                services: services as unknown as ServicesOf<TImports>,
            })
            return app
        },
    })
}

/**
 * Internal: assemble an `R` builder that registers routes on `app` and records
 * them in `declared`.
 */
function createBuilder(app: Hono, declared: DeclaredRoute[]): R {
    function register(
        verb: Verb,
        path: string,
        options: RouteOptions,
        handler: RouteHandler,
    ): R {
        declared.push({ method: verb, path, options })

        const middlewares: MiddlewareHandler[] = []
        middlewares.push(...validatorsFor(options))

        // ACL is a no-op when neither auth nor permission is requested.
        const needsAuth = options.auth ?? options.permission !== undefined
        if (needsAuth || options.condition !== undefined) {
            middlewares.push(
                requirePermission({
                    auth: needsAuth,
                    permission: options.permission,
                    condition: options.condition,
                }),
            )
        }

        // Hono's typed Handler signature is strict; the validator-derived
        // Variables map is for the user's benefit and is erased at runtime.
        // `on(METHOD, path, ...)` sidesteps the per-verb overload ambiguity
        // around spread-handler typing.
        app.on(
            [verb.toUpperCase()],
            [path],
            ...(middlewares as MiddlewareHandler[]),
            handler as Handler,
        )
        return r
    }

    const r: R = {
        get: (p, o, h) => register('get', p, o, h),
        post: (p, o, h) => register('post', p, o, h),
        put: (p, o, h) => register('put', p, o, h),
        patch: (p, o, h) => register('patch', p, o, h),
        delete: (p, o, h) => register('delete', p, o, h),
        options: (p, o, h) => register('options', p, o, h),
        raw: () => app,
    }
    return r
}
