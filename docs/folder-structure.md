core/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # public API surface — re-exports everything
│   ├── types.ts                    # shared public types
│   ├── context.ts                  # typed Hono Context augmentation (c.var.user, c.var.can, c.var.logger…)
│   ├── server.ts                   # Bun.serve wrapper + graceful shutdown
│   ├── config.ts                   # defineConfig() — single source of truth
│   │
│   ├── module/                     # the module system
│   │   ├── define.ts               # defineModule()
│   │   ├── contract.ts             # defineContract()
│   │   ├── registry.ts             # ModuleRegistry — collects all loaded modules
│   │   └── types.ts                # Module, Contract, ModuleManifest types
│   │
│   ├── bootstrap/                  # turns a list of modules into a running Hono app
│   │   ├── index.ts                # bootstrap() — the public entry point
│   │   ├── resolve.ts              # imports → providers wiring + missing-contract validation
│   │   ├── mount.ts                # mounts routes, ACL middleware, event subscriptions, JSX renderer
│   │   └── lifecycle.ts            # onBoot / onShutdown orchestration with order guarantees
│   │
│   ├── routing/                    # how routes are declared and registered
│   │   ├── code.ts                 # defineRoutes() + the r builder with validation shorthand
│   │   ├── file.ts                 # file-route manifest consumer (vite plugin emits the manifest)
│   │   └── openapi.ts              # zod schemas → OpenAPI 3.1 doc
│   │
│   ├── validation/
│   │   ├── zod.ts                  # request validation middleware + zod error formatting
│   │   └── env.ts                  # defineEnv() — typed env vars validated at boot
│   │
│   ├── errors/
│   │   ├── index.ts                # AppError, HttpError, ForbiddenError, NotFoundError, etc.
│   │   └── handler.ts              # global error → JSON response formatter, status mapping
│   │
│   ├── logger/
│   │   ├── pino.ts                 # pino factory, level config, pretty in dev
│   │   └── middleware.ts           # request logger (request id, method, path, status, ms)
│   │
│   ├── events/                     # cross-module async messaging
│   │   ├── define.ts               # defineEvents() — schemas for typed payloads
│   │   ├── bus.ts                  # EventBus interface (transport-agnostic)
│   │   └── memory.ts               # in-process implementation — the v1 default
│   │
│   ├── acl/                        # authorization
│   │   ├── roles.ts                # defineRoles() — app-level role registry
│   │   ├── define.ts               # defineAcl() — per-module permissions + defaults
│   │   ├── registry.ts             # AclRegistry — merges all module ACLs at boot
│   │   ├── resolve.ts              # can(user, permission) — the resolution algorithm
│   │   ├── middleware.ts           # requirePermission + condition runner + c.var.can attach
│   │   └── types.ts                # Permission, Role, AclMode, etc.
│   │
│   └── jsx/                        # SSR + islands for the website side
│       ├── renderer.ts             # render context, layout selection
│       ├── layout.ts               # defineLayout() — root layout primitive
│       ├── islands.ts              # island marker, hydration manifest
│       └── meta.ts                 # extracts/injects <head> meta from page modules
│
└── tests/
    ├── fixtures/
    │   ├── test-modules.ts         # canned modules for testing bootstrap
    │   └── test-acl.ts             # canned ACL setups
    ├── module.test.ts
    ├── contract.test.ts
    ├── bootstrap.test.ts
    ├── routing.test.ts
    ├── validation.test.ts
    ├── errors.test.ts
    ├── events.test.ts
    ├── acl.test.ts
    ├── lifecycle.test.ts
    └── jsx.test.ts