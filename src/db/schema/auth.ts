import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

/**
 * SQLite Drizzle schema for the auth module. Drop the export into your app's
 * Drizzle schema so the `DrizzleUserStore` / `DrizzleSessionStore` can talk
 * to the same client:
 *
 *   import * as authSchema from '@iguir/core/db/schema/auth'
 *   const db = createDb({ driver: 'sqlite', url, schema: { ...authSchema } })
 *
 * Roles are stored as a JSON-encoded string array; same for `permissionGrants`
 * and `permissionDenies`. The stores hide the encoding from callers.
 *
 * A Postgres variant lives next to this in `auth.pg.ts` (planned). Until then,
 * Postgres apps can model the schema themselves following the same shape.
 */
export const users = sqliteTable('iguir_users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    rolesJson: text('roles_json').notNull().default('[]'),
    permissionGrantsJson: text('permission_grants_json'),
    permissionDeniesJson: text('permission_denies_json'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(unixepoch() * 1000)`),
})

export const sessions = sqliteTable('iguir_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})

export const authSchema = { users, sessions } as const
export type AuthSchema = typeof authSchema

/**
 * Idempotent table creation. Useful for tests and zero-tool dev setups. Real
 * apps should run drizzle-kit migrations instead.
 */
export function createAuthTablesIfMissing(raw: {
    exec(sql: string): void
}): void {
    raw.exec(`
        CREATE TABLE IF NOT EXISTS iguir_users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            roles_json TEXT NOT NULL DEFAULT '[]',
            permission_grants_json TEXT,
            permission_denies_json TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );
        CREATE TABLE IF NOT EXISTS iguir_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES iguir_users(id) ON DELETE CASCADE,
            created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
            expires_at INTEGER NOT NULL
        );
    `)
}
