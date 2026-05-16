# {{name}}

A {{name}} app built with [@iguir/core](https://github.com/iguir/core) — a Hono-based meta-framework for Bun.

## Quick start

```sh
bun install
bun dev
```

The server listens on `http://localhost:3000`. Try:

```sh
curl http://localhost:3000/api/posts/health
curl -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"longenoughpw"}'
```

## Scripts

| Command           | What it does                                       |
| ----------------- | -------------------------------------------------- |
| `bun dev`         | Run with `--hot` (auto-reload on change).          |
| `bun start`       | Run in production mode.                            |
| `bun build`       | Bundle the server into `dist/`.                    |
| `bun test`        | Run the test suite via `bun test`.                 |
| `bun run routes`  | Print every declared route + permission.           |
| `bun run acl`     | Inspect roles + permissions.                       |
| `bun run openapi` | Generate an OpenAPI 3.1 document to `openapi.json`.|

## Layout

```
src/
├── main.ts                      # bootstrap + serve + graceful shutdown
├── app/                         # app-wide singletons (NOT a module)
│   ├── acl.ts                   # defineRoles({...})
│   ├── env.ts                   # validated environment
│   └── db.ts                    # Drizzle client + auth schema
└── modules/
    └── posts/                   # one full example module
        ├── posts.module.ts
        ├── posts.contract.ts    # public surface — what other modules can call
        ├── posts.acl.ts         # permissions
        ├── routes/api.ts
        ├── services/
        └── tests/
```

Cross-module imports must only go through `*.contract.ts` files — Biome enforces this. It keeps modules independent so they can later be extracted into microservices without ceremony.

## Generating modules

```sh
bunx app generate module billing
```

Adds a fully wired module under `src/modules/billing/`. Then add `billingModule` to `app.config.ts`.
