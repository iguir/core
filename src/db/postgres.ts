import { drizzle, type BunSQLDatabase } from 'drizzle-orm/bun-sql'
import type { PostgresDbConfig } from './types'

/** A Drizzle Postgres client paired with the underlying `Bun.sql` instance. */
export interface PostgresDb<
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    TSchema extends Record<string, any> = Record<string, never>,
> {
    /** Drizzle query interface. */
    drizzle: BunSQLDatabase<TSchema>
    /** Raw `Bun.sql` client — escape hatch for raw SQL, `.unsafe()`, etc. */
    // biome-ignore lint/suspicious/noExplicitAny: Bun's SQL type isn't re-exported
    raw: any
    /** Driver tag. */
    readonly driver: 'postgres'
    /** Close the connection pool. Safe to call multiple times. */
    close(): Promise<void>
}

/**
 * Open a Postgres database using `Bun.sql` and wire it through Drizzle.
 *
 *   const db = createPostgresDb({ url: env.DATABASE_URL, schema })
 *   await db.drizzle.select().from(schema.users)
 *
 * Bun.sql handles pooling + automatic reconnects. The `options` field is
 * forwarded verbatim — see Bun's `SQL` docs for the full list.
 */
export function createPostgresDb<
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    TSchema extends Record<string, any> = Record<string, never>,
>(
    config: Omit<PostgresDbConfig, 'driver'> & { schema?: TSchema },
): PostgresDb<TSchema> {
    // biome-ignore lint/suspicious/noExplicitAny: Bun's SQL constructor signature varies by version
    const SqlCtor = (Bun as unknown as { SQL: new (url: string, options?: unknown) => any }).SQL
    const raw = new SqlCtor(config.url, config.options)
    const d = drizzle(raw, { schema: config.schema })

    let closed = false
    return {
        drizzle: d,
        raw,
        driver: 'postgres',
        close: async () => {
            if (closed) return
            closed = true
            if (typeof raw.close === 'function') await raw.close()
            else if (typeof raw.end === 'function') await raw.end()
        },
    }
}
