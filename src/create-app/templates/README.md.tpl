# {{name}}

A {{name}} app built with [@iguir/core](https://github.com/iguir/core) — a Hono-based meta-framework for Bun.

## Quick start

```sh
docker compose up -d        # local Postgres on :5432
bun install
bun run db:push             # sync the Drizzle schema to the database
bun dev                     # → http://localhost:3000
```

Try it:

```sh
curl -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"longenoughpw"}'
```

A `Set-Cookie: {{name}}_session=...` header comes back. Reuse it on `/auth/me`:

```sh
curl -H 'cookie: {{name}}_session=<from above>' \
  http://localhost:3000/auth/me
```

## Scripts

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `bun dev`            | `bun --hot src/main.ts` — auto-reload on change.          |
| `bun start`          | Production mode (no `--hot`).                             |
| `bun build`          | Bundle the server into `dist/`.                           |
| `bun test`           | Run the test suite via `bun test`.                        |
| `bun run db:push`    | Sync Drizzle schema → DB. **Use this in dev**.            |
| `bun run db:generate`| Write a migration file from the latest schema change.     |
| `bun run db:migrate` | Apply pending migrations. **Use this in production**.     |
| `bun run db:studio`  | Open Drizzle Studio (web UI) at `https://local.drizzle.studio`. |
| `bun run routes`     | Print every declared route + permission.                  |
| `bun run acl`        | Inspect roles + permissions.                              |
| `bun run openapi`    | Generate an OpenAPI 3.1 document to `openapi.json`.       |

## Layout

```
.
├── docker-compose.yml         # local Postgres (port 5432)
├── drizzle.config.ts          # drizzle-kit settings
├── drizzle/                   # generated migrations
├── app.config.ts              # defineConfig({ roles, modules, server })
├── vite.config.ts             # @iguir/core/vite-plugin
└── src/
    ├── main.ts                # bootstrap + serve + graceful shutdown
    ├── app/                   # app-wide singletons (NOT a module)
    │   ├── acl.ts             # defineRoles({...})
    │   ├── env.ts             # validated env (DATABASE_URL, session config, …)
    │   ├── db.ts              # Drizzle Postgres client
    │   └── schema.ts          # all Drizzle tables (users, sessions, …)
    └── modules/
        └── auth/              # example module: cookie sessions + bcrypt-equivalent (Bun.password)
            ├── auth.module.ts
            ├── auth.contract.ts   # public surface — what other modules can call
            ├── auth.acl.ts        # permissions
            ├── events.ts          # auth.user.registered / .logged_in / .logged_out
            ├── middleware.ts      # session cookie → c.var.user
            ├── routes/api.ts      # POST /register|/login|/logout, GET /me
            ├── services/          # all DB queries; swap stores out when you outgrow them
            └── tests/
```

Cross-module imports must only go through `*.contract.ts` files — Biome enforces this. It keeps modules independent so they can later be extracted into microservices without ceremony.

## Switching auth strategies

The included auth module is a starting point — cookie sessions + `Bun.password` hashing — but it's just **code in your repo**, not a black box. Want OAuth, JWT, WebAuthn, or your own IdP? Edit / replace `src/modules/auth/` freely. The framework only requires that `c.var.user: { roles: string[] }` is set before `aclContext` runs, which is exactly what the `globalMiddleware` here does.

## Generating modules

```sh
bunx iguir generate module billing
```

Adds a fully wired module under `src/modules/billing/`. Then add `billingModule` to `app.config.ts`.
