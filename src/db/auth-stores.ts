import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import type {
    AuthUser,
    Session,
    SessionStore,
    UserStore,
} from '../auth/index'
import { authSchema, sessions, users } from './schema/auth'

/** What the Drizzle stores need from their host db. */
export interface DrizzleAuthStoreDeps {
    /** A Drizzle SQLite database built with the auth schema (or a superset). */
    drizzle: BunSQLiteDatabase<typeof authSchema>
}

/**
 * Drizzle-backed `UserStore`. Reads/writes the `iguir_users` table from
 * `db/schema/auth.ts`. Encoded roles/grants/denies are transparently
 * (de)serialised at the boundary so callers see plain string arrays.
 *
 *   import { createDb, DrizzleUserStore } from '@iguir/core/db'
 *   import * as authSchema from '@iguir/core/db/schema/auth'
 *
 *   const db = createDb({ driver: 'sqlite', url: './data.db', schema: authSchema })
 *   const userStore = new DrizzleUserStore({ drizzle: db.drizzle })
 */
export class DrizzleUserStore implements UserStore {
    constructor(private readonly deps: DrizzleAuthStoreDeps) {}

    async findById(id: string): Promise<AuthUser | null> {
        const rows = await this.deps.drizzle
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1)
        return rows[0] ? rowToUser(rows[0]) : null
    }

    async findByEmail(email: string): Promise<AuthUser | null> {
        const rows = await this.deps.drizzle
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1)
        return rows[0] ? rowToUser(rows[0]) : null
    }

    async create(
        input: Omit<AuthUser, 'id' | 'createdAt'> & { id?: string },
    ): Promise<AuthUser> {
        const id = input.id ?? crypto.randomUUID()
        const createdAt = new Date()
        try {
            await this.deps.drizzle.insert(users).values({
                id,
                email: input.email.toLowerCase(),
                passwordHash: input.passwordHash,
                rolesJson: JSON.stringify(input.roles ?? []),
                permissionGrantsJson: input.permissionGrants
                    ? JSON.stringify(input.permissionGrants)
                    : null,
                permissionDeniesJson: input.permissionDenies
                    ? JSON.stringify(input.permissionDenies)
                    : null,
                createdAt,
            })
        } catch (err) {
            if (isUniqueViolation(err)) {
                throw new Error(`[auth] user with email "${input.email}" already exists`)
            }
            throw err
        }
        return {
            id,
            email: input.email.toLowerCase(),
            passwordHash: input.passwordHash,
            roles: [...(input.roles ?? [])],
            permissionGrants: input.permissionGrants
                ? [...input.permissionGrants]
                : undefined,
            permissionDenies: input.permissionDenies
                ? [...input.permissionDenies]
                : undefined,
            createdAt,
        }
    }
}

/** Drizzle-backed `SessionStore`. */
export class DrizzleSessionStore implements SessionStore {
    constructor(private readonly deps: DrizzleAuthStoreDeps) {}

    async create(userId: string, ttlMs: number): Promise<Session> {
        const now = Date.now()
        const id = crypto.randomUUID()
        const session: Session = {
            id,
            userId,
            createdAt: new Date(now),
            expiresAt: new Date(now + ttlMs),
        }
        await this.deps.drizzle.insert(sessions).values(session)
        return session
    }

    async findById(id: string): Promise<Session | null> {
        const rows = await this.deps.drizzle
            .select()
            .from(sessions)
            .where(eq(sessions.id, id))
            .limit(1)
        const row = rows[0]
        if (!row) return null
        if (row.expiresAt.getTime() <= Date.now()) {
            await this.delete(id)
            return null
        }
        return row
    }

    async delete(id: string): Promise<void> {
        await this.deps.drizzle.delete(sessions).where(eq(sessions.id, id))
    }

    async deleteAllForUser(userId: string): Promise<void> {
        await this.deps.drizzle
            .delete(sessions)
            .where(eq(sessions.userId, userId))
    }
}

type UserRow = typeof users.$inferSelect

function rowToUser(row: UserRow): AuthUser {
    return {
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        roles: parseJsonArray(row.rolesJson),
        permissionGrants: row.permissionGrantsJson
            ? parseJsonArray(row.permissionGrantsJson)
            : undefined,
        permissionDenies: row.permissionDeniesJson
            ? parseJsonArray(row.permissionDeniesJson)
            : undefined,
        createdAt: row.createdAt,
    }
}

function parseJsonArray(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
        return []
    }
}

function isUniqueViolation(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const message = (err as { message?: string }).message ?? ''
    return /UNIQUE constraint failed/i.test(message)
}
