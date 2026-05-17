# Database (Drizzle)

`@iguir/core/db` ships a Bun-native Drizzle wiring. No `pg`, no `postgres`, no `better-sqlite3` — `bun:sqlite` and `Bun.sql` only.

## Create a client

```ts
import { createDb } from '@iguir/core/db'
import * as schema from './schema'

export const db = createDb({
    driver: 'sqlite',
    url: 'file:./data.db',                       // or ':memory:'
    schema,
})

await db.drizzle.select().from(schema.posts).where(eq(schema.posts.id, '1'))
```

For Postgres:

```ts
export const db = createDb({
    driver: 'postgres',
    url: process.env.DATABASE_URL!,
    schema,
})
```

Returned object always has the same shape:

```ts
{
    drizzle: BunSQLiteDatabase<TSchema> | BunSQLDatabase<TSchema>
    raw: Database | BunSQL                       // escape hatch: PRAGMA, transactions, .unsafe()
    driver: 'sqlite' | 'postgres'
    close(): void | Promise<void>                // idempotent
}
```

## Drizzle schema

The framework ships a Drizzle schema for the auth module's tables (`iguir_users`, `iguir_sessions`) at `@iguir/core/db/schema/auth`. Spread it into your app's schema:

```ts
// src/app/db.ts
import { createSqliteDb, authSchema, createAuthTablesIfMissing } from '@iguir/core/db'
import { env } from './env'

export const db = createSqliteDb({
    url: env.DATABASE_URL,
    schema: authSchema,
})

// Idempotent — safe on every boot. Real apps use drizzle-kit migrations.
createAuthTablesIfMissing(db.raw)
```

## Drizzle-backed auth stores

Plug the Drizzle client into the auth module:

```ts
import { DrizzleUserStore, DrizzleSessionStore } from '@iguir/core/db'

createAuthModule({
    userStore: new DrizzleUserStore({ drizzle: db.drizzle }),
    sessionStore: new DrizzleSessionStore({ drizzle: db.drizzle }),
})
```

Roles, permission grants, and permission denies are JSON-encoded in single columns — the stores hide the serialization. Expired sessions are dropped on read.

## Migrations

Use `drizzle-kit` directly — the framework doesn't bundle it:

```sh
bun add -d drizzle-kit
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

A `drizzle.config.ts` looks like this:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './src/app/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: { url: 'file:./data.db' },
})
```

`iguir db:*` CLI commands are deferred to v1.1; for now use `drizzle-kit` directly.

## Why not pg / postgres / better-sqlite3?

Bun's built-ins are equivalent or faster for our use cases, ship by default, and avoid the native-module compile dance. If you have an existing schema in another lib, write a thin adapter — the framework only cares about the `EventBus` / `UserStore` / `SessionStore` interfaces.

→ Next: [CLI (iguir)](./cli).
