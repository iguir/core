# @iguir/core — project guidance

> A Hono-based meta-framework for Bun. **Built on Hono, never forked.** Vite for build/dev, Zod for validation, Drizzle ORM, Pino logger, `hono/jsx` for SSR. Bun-only — no Node support.

This file is auto-loaded into every Claude Code session. Keep it short and decision-shaped.

---

## North-star principles (non-negotiable)

1. **Build on Hono, never fork it.** Pin a stable major. We add layers; Hono stays untouched.
2. **Use Vite for build/dev.** Never reinvent the bundler.
3. **One way to do common things.** Validation = Zod. ORM = Drizzle. Logger = Pino. JSX = `hono/jsx`. Tests = `bun:test`. Lint+Format = Biome.
4. **Modules are explicit, not implicit.** Register via `defineModule({...})`. No filesystem scanning for module discovery.
5. **Hybrid routing.** File-based for pages, code-based for APIs (`defineRoutes`). Same module can declare both.
6. **Testing is the API, not an add-on.** Use Hono's `app.request()` — no HTTP server needed.
7. **Escape hatches everywhere.** Anyone can drop down to raw Hono at any layer.
8. **No DI container.** Pass dependencies via `c.var.x`, typed through module augmentation.
9. **Documentation ships with v1.0.** Not "we'll write docs after."

## Out of scope (v1)

- ❌ Forking Hono.
- ❌ Filesystem auto-discovery of modules.
- ❌ Custom bundler / dev server.
- ❌ Node support.
- ❌ Real-time / WebSockets, job queues, admin panel, cron — all deferred to v1.1+.

## Critical for v1 (discipline features — don't skip)

`defineContract`, `imports`/`provides` on modules, in-memory event bus, and the cross-module-import lint rule. Skipping these = no microservice extraction story later.

---

## Tech stack (finalized)

| Concern        | Choice                                         |
| -------------- | ---------------------------------------------- |
| Runtime        | Bun (latest stable)                            |
| HTTP           | Hono `^4` (never forked)                       |
| Build/Dev      | Vite + custom `@iguir/vite-plugin`               |
| Language       | TypeScript strict, `const T` generics          |
| Validation     | Zod                                            |
| ORM            | Drizzle (`Bun.sql` for Postgres, `bun:sqlite`) |
| Logger         | Pino                                           |
| Testing        | `bun:test`                                     |
| Lint+Format    | Biome (single tool)                            |
| Password hash  | `Bun.password`                                 |
| JSX            | `hono/jsx` (SSR + selective hydration)         |

---

## Source tree — `packages/core` (this repo)

```
src/
├── index.ts                # public API surface
├── types.ts                # shared public types
├── context.ts              # typed Hono Context augmentation
├── server.ts               # Bun.serve wrapper + graceful shutdown
├── config.ts               # defineConfig()
├── module/
│   ├── define.ts           # defineModule()
│   ├── contract.ts         # defineContract()
│   ├── registry.ts         # ModuleRegistry
│   └── types.ts
├── bootstrap/
│   ├── index.ts            # bootstrap() — public entry
│   ├── resolve.ts          # imports → providers
│   ├── mount.ts            # mounts routes, ACL, events, JSX
│   └── lifecycle.ts        # onBoot / onShutdown orchestration
├── routing/
│   ├── code.ts             # defineRoutes() + r builder
│   ├── file.ts             # file-route manifest consumer
│   └── openapi.ts          # Zod → OpenAPI 3.1
├── validation/{zod,env}.ts
├── errors/{index,handler}.ts
├── logger/{pino,middleware}.ts
├── events/{define,bus,memory}.ts
├── acl/
│   ├── types.ts            ✅ done
│   ├── roles.ts            ✅ done — defineRoles()
│   ├── define.ts           ✅ done — defineAcl()
│   ├── registry.ts         ✅ done — AclRegistry
│   ├── resolve.ts          ✅ done — can() + createChecker()
│   └── middleware.ts       ✅ done — aclContext + requirePermission
└── jsx/{renderer,layout,islands,meta}.ts
```

## Build order (do NOT skip steps)

Each step must work end-to-end before starting the next.

1. **Types & factories** ✅
2. **ACL runtime** ✅
3. **Bootstrap & runtime** ✅
4. **Routing & validation** ✅ — `defineRoutes` + `r` builder with type-narrowed `c.req.valid()`, Zod middleware, error handler.
5. **Logging & events** ✅ — Pino, in-memory EventBus, `defineEvents`.
6. **Validation surface** ✅ — `defineEnv`, `defineConfig`, Context types, OpenAPI 3.1 generator.
7. **JSX layer** ✅ — `renderPage`, `defineLayout` + `RootLayout`, `defineIsland` + registry, `defineMeta` + `renderMetaTags`, `mountPages(manifest)` consumer.
8. **Sibling packages** — `@iguir/testing` ✅, `@iguir/cli` ✅, `@iguir/db` ✅, `@iguir/auth` ✅, `create-iguir` ✅, `@iguir/vite-plugin` ✅ (page virtual modules + islands client + HMR), docs ⏭.

---

## ACL — three-layer model

1. **Route layer:** `permission: 'posts.delete'` on the route.
2. **Module ACL:** `defineAcl({ permissions, defaults: { admin: ['*'], editor: [...] } })`.
3. **App roles:** `defineRoles({ admin, editor, author, viewer, customer })`.
4. **User overrides:** `user.permissionGrants` / `user.permissionDenies`.

Two enforcement modes (per permission, not global):
- **strict** — only role grants count; user grants ignored.
- **flexible** (default) — role grants + user grants − user denies.

Resolution (see `src/acl/resolve.ts`):
1. Unknown permission → false (fail closed)
2. Explicit deny on subject → false (always wins)
3. Any of subject's roles grants → true
4. Mode is flexible AND subject has explicit grant → true
5. Else → false

Permission naming: `module.action[.modifier]` (e.g. `posts.update`, `posts.update.any`). Each permission is owned by exactly one module; namespace must match module name. Validated at `defineAcl` time.

---

## Code-quality rules

1. **TypeScript strict mode.** No `any`; no `@ts-ignore` without a justifying comment.
2. **`const T` generics** in factory functions so literal types are inferred.
3. **Validate at definition time, not at first request.** Throw with `[module:name]` tag.
4. **Fail closed.** Unknown permissions → false. Missing config → throw.
5. **No global mutable state.** Registries are built at bootstrap and passed in.
6. **Public surface is small.** Anything not re-exported from `src/index.ts` is internal.
7. **Tests live in a per-module `tests/` subfolder** (e.g. `src/acl/tests/middleware.test.ts`, never `src/acl/middleware.test.ts`). Cross-cutting tests live in the repo-root `tests/`.
8. **Error messages are actionable.** Include what failed, where (`[acl:posts]` etc.), and known values.
9. **JSDoc on every exported symbol.** It powers IDE hovers; half of the DX.
10. **Biome is the single source of style.** No ESLint, no Prettier.

## Critical lint rule (ship in the user template)

Cross-module imports must only go through `*.contract.ts` — enforced by Biome's `noRestrictedImports`. Without this rule, microservice extraction dies within 3 months.

---

## Commit conventions

- Format: `type(scope): subject` — Conventional Commits, enforced by commitlint + husky.
- Allowed scopes are defined in `commitlint.config.mjs`. Match the source-tree directory (`acl`, `module`, `bootstrap`, `routing`, …) plus repo-level (`deps`, `release`, `docs`, `tooling`, …).
- One scope per commit. If a change spans `acl` and `module`, split it.
- Subject is lowercase, imperative, no period. Body separated by a blank line.

---

## Bun cheat-sheet (project defaults)

- `bun <file>` over `node`/`ts-node`. `bun test` over jest/vitest. `bunx` over npx.
- `Bun.serve()` for HTTP (we wrap it in `src/server.ts`). `bun:sqlite`, `Bun.sql`, `Bun.redis` over Node libs.
- `Bun.password` for hashing. `Bun.file` over `node:fs` read/write. `Bun.$` over `execa`.
- Bun auto-loads `.env` — don't add `dotenv`.

---

## When in doubt

- **Cite the north-star principle** behind structural choices.
- **Flag deviations explicitly** and explain why.
- **Ask before guessing** on API shape that hasn't been settled.
