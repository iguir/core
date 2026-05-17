/**
 * `@iguir/db` (colocated in `src/db/` — will move to `packages/db` on monorepo
 * split). A thin, Bun-native Drizzle wiring layer.
 *
 *   const db = createDb({ driver: 'sqlite', url: ':memory:', schema })
 *   const db = createDb({ driver: 'postgres', url: env.DATABASE_URL, schema })
 *
 * No `pg`, `postgres`, or `better-sqlite3` — Bun's built-ins drive everything.
 * If you need migration tooling, add `drizzle-kit` to your project; the
 * framework intentionally doesn't bundle it.
 */

import { createPostgresDb, type PostgresDb } from './postgres'
import { createSqliteDb, type SqliteDb } from './sqlite'
import type { DbConfig } from './types'

/** Discriminated union of every driver's client. */
export type DbClient<
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    TSchema extends Record<string, any> = Record<string, never>,
> = SqliteDb<TSchema> | PostgresDb<TSchema>

/**
 * Build a Drizzle client for the configured driver. Throws synchronously on
 * an unknown driver so misconfiguration surfaces at startup, not at first
 * query.
 */
export function createDb<
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    TSchema extends Record<string, any> = Record<string, never>,
>(config: DbConfig & { schema?: TSchema }): DbClient<TSchema> {
    switch (config.driver) {
        case 'sqlite':
            return createSqliteDb<TSchema>(config) as DbClient<TSchema>
        case 'postgres':
            return createPostgresDb<TSchema>(config) as DbClient<TSchema>
        default: {
            // Exhaustiveness — any new driver added to DbConfig must land here.
            const _exhaustive: never = config
            throw new Error(
                `[db] unknown driver: ${JSON.stringify(_exhaustive)}`,
            )
        }
    }
}

export { createSqliteDb, type SqliteDb } from './sqlite'
export { createPostgresDb, type PostgresDb } from './postgres'
export type { DbConfig, DbDriver, SqliteDbConfig, PostgresDbConfig } from './types'
