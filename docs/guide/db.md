# Database (Drizzle)

`@iguir/core` ships a Bun-native Drizzle wiring helper. No `pg`, no `postgres`, no `better-sqlite3` — `bun:sqlite` and `Bun.sql` only.

The database layer is **optional**. The framework doesn't bake in any schema or assume your app needs persistence. Wire one when you need it.

## Create a client

```ts
import { createDb } from '@iguir/core'
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

`createDb` also has driver-specific exports if you want to skip the dispatcher: `createSqliteDb` and `createPostgresDb`.

## Defining a schema

Schemas are pure Drizzle — the framework doesn't add a DSL. Per their docs:

```ts
// src/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable('posts', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})
```

Pass the module to `createDb({ schema })` so Drizzle's typed queries pick up your tables.

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
    schema: './src/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: { url: 'file:./data.db' },
})
```

`iguir db:*` CLI commands are deferred to v1.1; for now use `drizzle-kit` directly.

## Wiring it through a module

The most common pattern: instantiate the client once in `src/app/db.ts`, then pass it into module factories that need it.

```ts
// src/app/db.ts
import { createSqliteDb } from '@iguir/core'
import { env } from './env'
import * as schema from './schema'

export const db = createSqliteDb({
    url: env.DATABASE_URL,
    schema,
})
```

```ts
// src/modules/posts/posts.module.ts
import { defineModule } from '@iguir/core'
import { db } from '../../app/db'
import { createPostsService } from './services'

const service = createPostsService(db.drizzle)

export const postsModule = defineModule({
    name: 'posts',
    provides: postsContract,
    implementation: () => service,
    routes: { handler: createApiRoutes(service), prefix: '/api/posts' },
    onShutdown: () => db.close(),
})
```

`onShutdown` makes the client close cleanly on `SIGTERM` / `SIGINT`.

## Why not pg / postgres / better-sqlite3?

Bun's built-ins are equivalent or faster, ship by default, and avoid the native-module compile dance. If you have an existing schema in another lib, write a thin adapter — `createDb`'s only requirement is what Drizzle's adapter API accepts.

→ Next: [CLI (iguir)](./cli).
