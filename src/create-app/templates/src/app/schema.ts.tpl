/**
 * App-wide Drizzle schema. One database per app, so the schema is app-level —
 * modules import the tables they need from here.
 *
 * Adding a new module's tables:
 *   1. Define them at the bottom of this file (or in a sibling file, then
 *      re-export here).
 *   2. Run `bun run db:push` to sync the schema to your dev Postgres.
 *   3. For production, generate a migration with `bun run db:generate` and
 *      apply it with `bun run db:migrate`.
 */

import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ── auth module tables ─────────────────────────────────────────────────────

export const users = pgTable('users', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    roles: jsonb('roles').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    permissionGrants: jsonb('permission_grants').$type<string[] | null>(),
    permissionDenies: jsonb('permission_denies').$type<string[] | null>(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
})

export const sessions = pgTable('sessions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
