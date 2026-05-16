import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import type { SqliteDbConfig } from './types'

/** A Drizzle SQLite client paired with the underlying `bun:sqlite` handle. */
export interface SqliteDb<
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    TSchema extends Record<string, any> = Record<string, never>,
> {
    /** Drizzle query interface — call `.select()`, `.insert()`, etc. */
    drizzle: BunSQLiteDatabase<TSchema>
    /** Raw `bun:sqlite` connection — escape hatch for `PRAGMA`, backups, etc. */
    raw: Database
    /** Driver tag. */
    readonly driver: 'sqlite'
    /** Close the underlying SQLite handle. Safe to call multiple times. */
    close(): void
}

/**
 * Open a SQLite database using `bun:sqlite` and wire it through Drizzle.
 *
 *   const db = createSqliteDb({ url: ':memory:', schema })
 *   await db.drizzle.select().from(schema.users)
 */
export function createSqliteDb<
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    TSchema extends Record<string, any> = Record<string, never>,
>(config: Omit<SqliteDbConfig, 'driver'> & { schema?: TSchema }): SqliteDb<TSchema> {
    const path = normaliseSqliteUrl(config.url)
    const raw = new Database(path)
    // WAL is a sane default for everything except `:memory:`.
    if (path !== ':memory:') raw.exec('PRAGMA journal_mode = WAL;')

    const d = drizzle(raw, { schema: config.schema })

    let closed = false
    return {
        drizzle: d,
        raw,
        driver: 'sqlite',
        close: () => {
            if (closed) return
            closed = true
            raw.close()
        },
    }
}

/** Strip the optional `file:` prefix so `bun:sqlite` understands it. */
function normaliseSqliteUrl(url: string): string {
    if (url === ':memory:') return url
    if (url.startsWith('file:')) return url.slice('file:'.length)
    return url
}
