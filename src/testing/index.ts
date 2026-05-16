/**
 * `@iguir/testing` (currently colocated in `src/testing/` — will move to its own
 * package when this repo becomes a monorepo).
 *
 * Goal: tests that exercise the whole framework end-to-end without spinning up
 * `Bun.serve`. Built on `app.request()` — the same path Hono uses internally.
 *
 *   const app = await testApp({
 *     roles,
 *     modules: [usersModule, postsModule],
 *     user: { roles: ['editor'] },   // every request runs as this user
 *   })
 *   const { status, body } = await app.json('/api/posts')
 */

import { Hono } from 'hono'
import { aclContext, type AclUser } from '../acl/middleware'
import { AclRegistry } from '../acl/registry'
import type { AclSpec, Roles } from '../acl/types'
import { InMemoryEventBus } from '../events/memory'
import type { EventBus } from '../events/bus'
import type { DefinedEvents } from '../events/define'
import { createErrorHandler } from '../errors/handler'
import { Lifecycle } from '../bootstrap/lifecycle'
import { resolveServices, type ServiceRegistry } from '../bootstrap/resolve'
import { ModuleRegistry } from '../module/registry'
import type {
    ModuleContract,
    ContractMethods,
} from '../module/contract'
import type { ModuleLogger, ModuleSpec, ServicesOf } from '../module/types'
import type { DefinedRoutes } from '../routing/code'
import { mountPages } from '../routing/file'
import type { PageManifest } from '../jsx/types'

/** Options accepted by `testApp()`. */
export interface TestAppOptions {
    roles: Roles
    modules: readonly ModuleSpec[]
    /** A baseline authenticated user for every request — override per-call via `.as(user)`. */
    user?: AclUser
    /** Custom logger; defaults to a silent one. */
    logger?: ModuleLogger
    /** Custom event bus; defaults to in-memory with event collection enabled. */
    eventBus?: EventBus
}

/** Per-request init that can override the baseline user. */
export interface TestRequestInit extends RequestInit {
    user?: AclUser | null
}

/** A captured event for assertion via `app.events()`. */
export interface CapturedEvent {
    name: string
    payload: unknown
    at: number
}

/** Result of `app.json(path, init)`. */
export interface JsonResponse<T = unknown> {
    status: number
    headers: Headers
    body: T
}

/** The handle returned by `testApp()`. */
export interface TestApp {
    /** Underlying Hono app — drop down to it for raw fetch shape. */
    readonly app: Hono
    readonly services: ServiceRegistry
    readonly acl: AclRegistry
    readonly bus: EventBus
    readonly logger: ModuleLogger
    readonly lifecycle: Lifecycle

    /** Fire a request through Hono's in-memory fetch path. */
    request(path: string, init?: TestRequestInit): Promise<Response>

    /** Convenience: parse the response body as JSON. */
    json<T = unknown>(path: string, init?: TestRequestInit): Promise<JsonResponse<T>>

    /** Returns a new view bound to a different user (or anonymous if null). */
    as(user: AclUser | null): TestApp

    /** Typed access to a module's services for direct calls in unit tests. */
    service<TContract extends { name: string; methods: ContractMethods }>(
        contract: TContract,
    ): ServicesOf<readonly [TContract & ModuleContract]>[TContract['name']]

    /** Capture of events published since `testApp()` (or last `clearEvents()`). */
    events(): readonly CapturedEvent[]
    /** Clear the captured-events buffer. */
    clearEvents(): void

    /** Run all `onShutdown` hooks; safe to call multiple times. */
    shutdown(): Promise<void>
}

/**
 * Build a fully-wired test app:
 *
 *   1. AclRegistry from `roles` + each module's `acl`.
 *   2. ModuleRegistry (topo-sorted; missing-import errors surface here).
 *   3. ServiceRegistry — every `implementation` factory is called.
 *   4. Event bus + subscriptions + a collector for `app.events()`.
 *   5. Hono app: error handler → user-injector → aclContext → module routes.
 *   6. Lifecycle controller — `onBoot` runs synchronously, `shutdown()` exposed.
 *
 * Unlike `bootstrap()`, the user-injector runs BEFORE `aclContext`, so
 * permission checks see the test user. Use `.as(user)` for per-request overrides.
 */
export async function testApp(options: TestAppOptions): Promise<TestApp> {
    const logger = options.logger ?? silentLogger()

    const moduleAcls = options.modules
        .map((m) => m.acl)
        .filter((a): a is AclSpec => a !== undefined)
    const acl = new AclRegistry(options.roles, moduleAcls)

    const registry = new ModuleRegistry(options.modules)
    const services = await resolveServices(registry, { logger })

    const bus = options.eventBus ?? new InMemoryEventBus({ logger })
    for (const m of registry.inBootOrder()) {
        const ev = m.events as DefinedEvents | undefined
        if (ev) bus.registerAll(ev)
    }
    for (const m of registry.inBootOrder()) {
        for (const [name, handler] of Object.entries(m.subscriptions ?? {})) {
            bus.subscribe(name, handler)
        }
    }

    // Wrap the bus so every publish is captured for `app.events()`.
    const captured: CapturedEvent[] = []
    const originalPublish = bus.publish.bind(bus)
    bus.publish = async <T extends { name: string; schema: unknown }>(
        event: T | string,
        payload: unknown,
    ) => {
        const name = typeof event === 'string' ? event : event.name
        captured.push({ name, payload, at: Date.now() })
        return originalPublish(event as never, payload as never)
    }

    const app = new Hono()
    app.onError(createErrorHandler({ logger }))

    // Modules' global middleware (auth, etc.) — installed before the test
    // harness's user injector so the injector can override authenticated state
    // when a per-request `user` is supplied.
    for (const m of registry.inBootOrder()) {
        for (const mw of m.globalMiddleware ?? []) {
            app.use('*', mw)
        }
    }

    // User injector — reads the `x-test-user` header (set by the harness's
    // `.request(...)`) and sets `c.var.user`. We deliberately do NOT fall back
    // to a stored baseline here; the harness controls the header, so any
    // baseline + per-request override semantics live in one place.
    app.use('*', async (c, next) => {
        const header = c.req.header('x-test-user')
        if (header) {
            const user = parseUserHeader(header)
            if (user) c.set('user', user)
        }
        await next()
    })
    app.use('*', aclContext({ registry: acl }))

    for (const m of registry.inBootOrder()) {
        if (m.routes) {
            const defined = m.routes.handler as unknown as DefinedRoutes
            const picked = services.pickFor(
                (m.imports as readonly ModuleContract[] | undefined) ?? [],
            ) as unknown as ServicesOf<readonly ModuleContract[]>
            const sub = await defined.build(picked)
            app.route(m.routes.prefix ?? '/', sub)
        }
        if (m.pages) {
            const pageSub = mountPages(m.pages.manifest as PageManifest)
            app.route(m.pages.prefix ?? '/', pageSub)
        }
    }

    const lifecycle = new Lifecycle({ registry, services, logger, bus })
    await lifecycle.boot()

    const harness = createHarness({
        app,
        services,
        acl,
        bus,
        logger,
        lifecycle,
        baseline: options.user,
        captured,
    })
    return harness
}

interface HarnessDeps {
    app: Hono
    services: ServiceRegistry
    acl: AclRegistry
    bus: EventBus
    logger: ModuleLogger
    lifecycle: Lifecycle
    baseline: AclUser | null | undefined
    captured: CapturedEvent[]
}

function createHarness(deps: HarnessDeps): TestApp {
    const make = (userOverride?: AclUser | null): TestApp => {
        const baselineUser =
            userOverride === undefined ? deps.baseline : userOverride

        async function request(
            path: string,
            init: TestRequestInit = {},
        ): Promise<Response> {
            const headers = new Headers(init.headers)
            const user = init.user === undefined ? baselineUser : init.user
            if (user) headers.set('x-test-user', encodeUserHeader(user))
            else headers.delete('x-test-user')
            return deps.app.request(path, { ...init, headers })
        }

        async function json<T = unknown>(
            path: string,
            init?: TestRequestInit,
        ): Promise<JsonResponse<T>> {
            const res = await request(path, init)
            const text = await res.text()
            const body = text === '' ? (undefined as unknown as T) : (JSON.parse(text) as T)
            return { status: res.status, headers: res.headers, body }
        }

        return {
            app: deps.app,
            services: deps.services,
            acl: deps.acl,
            bus: deps.bus,
            logger: deps.logger,
            lifecycle: deps.lifecycle,
            request,
            json,
            as: (u) => make(u),
            service: (contract) =>
                deps.services.require(contract as unknown as ModuleContract) as never,
            events: () => deps.captured.slice(),
            clearEvents: () => {
                deps.captured.length = 0
            },
            shutdown: async () => {
                await deps.lifecycle.shutdown()
            },
        }
    }
    return make()
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

/**
 * Per-request users are smuggled through the `x-test-user` header as
 * base64-encoded JSON. We never read the real `Authorization` header in tests
 * — the framework is auth-agnostic, and this keeps tests independent of any
 * specific auth strategy.
 */
function encodeUserHeader(user: AclUser): string {
    return Buffer.from(JSON.stringify(user), 'utf8').toString('base64')
}

function parseUserHeader(header: string): AclUser | undefined {
    try {
        return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as AclUser
    } catch {
        return undefined
    }
}
