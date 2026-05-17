/**
 * `@iguir/core` — public surface.
 *
 * This umbrella file re-exports every primitive the framework offers so a
 * consumer can simply:
 *
 *   import { defineModule, defineRoutes, defineConfig } from '@iguir/core'
 *
 * Sub-path imports (`@iguir/core/jsx`, `@iguir/core/auth`, etc.) stay
 * available for codebases that prefer narrower entry points — they have the
 * same effect, just smaller individual import surfaces.
 */

// ── App entry: bootstrap + serve + config ──────────────────────────────────
export { bootstrap } from './bootstrap/index'
export type {
    BootstrapConfig,
    BootstrappedApp,
} from './bootstrap/index'
export { Lifecycle, moduleSpecsInReverseBootOrder } from './bootstrap/lifecycle'
export type { LifecycleDeps, ShutdownReport } from './bootstrap/lifecycle'
export { ServiceRegistry, resolveServices } from './bootstrap/resolve'
export type { ResolveServicesDeps } from './bootstrap/resolve'
export { mount } from './bootstrap/mount'
export type { MountDeps } from './bootstrap/mount'
export { default as serve } from './server'
export { defineConfig, defaultConfig } from './config'
export type { AppConfig, ServerConfig } from './types'
export type {
    AppContext,
    AppContextVariables,
} from './context'

// ── ACL ────────────────────────────────────────────────────────────────────
export { defineRoles } from './acl/roles'
export type { RoleNames } from './acl/roles'
export { defineAcl } from './acl/define'
export { AclRegistry } from './acl/registry'
export { can, createChecker, anonymousChecker } from './acl/resolve'
export type { Checker } from './acl/resolve'
export { aclContext, requirePermission } from './acl/middleware'
export type {
    AclContextOptions,
    AclUser,
    AclVariables,
    RequirePermissionOptions,
} from './acl/middleware'
export type {
    AclDefaults,
    AclMode,
    AclSpec,
    AclSubject,
    CompiledAcl,
    PermissionInfo,
    RoleDefinition,
    Roles,
} from './acl/types'

// ── Modules + contracts ────────────────────────────────────────────────────
export { defineModule } from './module/define'
export { defineContract } from './module/contract'
export type {
    ContractMethod,
    ContractMethods,
    ModuleContract,
} from './module/contract'
export { ModuleRegistry } from './module/registry'
export type {
    Implementation,
    ImplementationContext,
    ImplementationFactory,
    ModuleApiRoutes,
    ModuleBootContext,
    ModuleBus,
    ModuleEvents,
    ModuleLogger,
    ModulePages,
    ModuleRoutes,
    ModuleSpec,
    ModuleSubscriptions,
    ServicesOf,
    SubscriptionHandler,
} from './module/types'

// ── Routing (code + file) + OpenAPI ────────────────────────────────────────
export { defineRoutes } from './routing/code'
export type {
    DeclaredRoute,
    DefinedRoutes,
    R,
    RouteHandler,
    RouteOptions,
    RoutesBuilder,
    RoutesContext,
} from './routing/code'
export { mountPages } from './routing/file'
export { generateOpenApi } from './routing/openapi'
export type {
    OpenApiDocument,
    OpenApiInfo,
    OpenApiOptions,
} from './routing/openapi'

// ── Validation ─────────────────────────────────────────────────────────────
export { validator, validatorsFor } from './validation/zod'
export type { Infer, RouteValidators, ValidationTarget } from './validation/zod'
export { defineEnv } from './validation/env'
export type { DefineEnvOptions, Env } from './validation/env'

// ── Errors ─────────────────────────────────────────────────────────────────
export {
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    HttpError,
    NotFoundError,
    RedirectError,
    UnauthorizedError,
    ValidationError,
    isAppError,
} from './errors/index'
export { createErrorHandler, toErrorBody } from './errors/handler'
export type { ErrorHandlerOptions, ErrorResponseBody } from './errors/handler'

// ── Logger ─────────────────────────────────────────────────────────────────
export { createLogger } from './logger/pino'
export type { CreateLoggerOptions, PinoLogger } from './logger/pino'
export { requestLogger } from './logger/middleware'
export type { LoggerVariables, RequestLoggerOptions } from './logger/middleware'

// ── Events ─────────────────────────────────────────────────────────────────
export { defineEvents } from './events/define'
export type {
    DefinedEvents,
    EventDefinition,
    EventPayload,
    EventsSchemaMap,
} from './events/define'
export { eventName, eventSchema } from './events/bus'
export type {
    EventBus,
    EventBusDeps,
    Subscriber,
    Unsubscribe,
} from './events/bus'
export { InMemoryEventBus } from './events/memory'

// ── JSX / SSR / islands ────────────────────────────────────────────────────
export { defineMeta, mergeMeta, renderMetaTags } from './jsx/meta'
export { defineLayout, RootLayout } from './jsx/layout'
export { defineIsland, getDeclaredIslands } from './jsx/islands'
export type { IslandRecord } from './jsx/islands'
export { renderPage } from './jsx/renderer'
export type {
    JsxElement,
    LayoutComponent,
    LayoutProps,
    Loader,
    LoaderResult,
    PageComponent,
    PageEntry,
    PageManifest,
    PageMeta,
    PageProps,
} from './jsx/types'

// ── Testing harness ────────────────────────────────────────────────────────
export { testApp } from './testing/index'
export type {
    CapturedEvent,
    JsonResponse,
    TestApp,
    TestAppOptions,
    TestRequestInit,
} from './testing/index'

// ── Drizzle wiring (Bun-native) ────────────────────────────────────────────
export {
    createDb,
    createPostgresDb,
    createSqliteDb,
} from './db/index'
export type {
    DbClient,
    DbConfig,
    DbDriver,
    PostgresDb,
    PostgresDbConfig,
    SqliteDb,
    SqliteDbConfig,
} from './db/index'
