/**
 * Public types for the @iguir/db layer (colocated in `src/db/` until monorepo
 * split). Concrete client types live next to each driver.
 */

/** Supported Bun-native database drivers. */
export type DbDriver = 'sqlite' | 'postgres'

/** Common config every driver accepts. Driver-specific config lives in its module. */
export interface BaseDbConfig {
    /** A Drizzle schema object — `{ users, sessions, ... }`. */
    // biome-ignore lint/suspicious/noExplicitAny: schema shape is user-supplied
    schema?: Record<string, any>
}

/** SQLite-specific configuration. */
export interface SqliteDbConfig extends BaseDbConfig {
    driver: 'sqlite'
    /**
     * SQLite location. Accepts a filesystem path (`'./data.db'`), the
     * in-memory sentinel (`':memory:'`), or a `file:` URL.
     */
    url: string
}

/** Postgres-specific configuration. */
export interface PostgresDbConfig extends BaseDbConfig {
    driver: 'postgres'
    /** Postgres connection string (e.g. `postgres://user:pw@host/db`). */
    url: string
    /** Optional `Bun.sql` options forwarded verbatim. */
    options?: Record<string, unknown>
}

/** Union of every driver's config — what `createDb()` accepts. */
export type DbConfig = SqliteDbConfig | PostgresDbConfig
