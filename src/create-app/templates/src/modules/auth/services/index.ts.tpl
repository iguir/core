import { eq } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import type { AppSchema } from '../../../app/db'
import { sessions, users } from '../../../app/schema'
import type { PublicUser } from '../auth.contract'

/** Internal user row (includes the password hash; never sent over the wire). */
export interface AuthUser {
    id: string
    email: string
    passwordHash: string
    roles: string[]
    permissionGrants?: string[] | null
    permissionDenies?: string[] | null
    createdAt: Date
}

export interface Session {
    id: string
    userId: string
    createdAt: Date
    expiresAt: Date
}

/** Project internal → API shape; centralised so passwordHash can't leak. */
export function toPublicUser(u: AuthUser): PublicUser {
    return {
        id: u.id,
        email: u.email,
        roles: [...u.roles],
        createdAt: u.createdAt.toISOString(),
    }
}

/**
 * Drizzle-backed auth service. Wraps every database query the auth module
 * needs so the rest of the code (routes, middleware, module factory) only
 * talks to `service.xxx(...)`. Swap this out the day you outgrow it —
 * nothing else in the module imports the schema directly.
 */
export function createAuthService(drizzle: BunSQLDatabase<AppSchema>) {
    return {
        async findUserById(id: string): Promise<AuthUser | null> {
            const rows = await drizzle
                .select()
                .from(users)
                .where(eq(users.id, id))
                .limit(1)
            return rows[0] ? rowToUser(rows[0]) : null
        },

        async findUserByEmail(email: string): Promise<AuthUser | null> {
            const rows = await drizzle
                .select()
                .from(users)
                .where(eq(users.email, email.toLowerCase()))
                .limit(1)
            return rows[0] ? rowToUser(rows[0]) : null
        },

        async createUser(input: {
            email: string
            password: string
            roles: string[]
        }): Promise<AuthUser> {
            const passwordHash = await Bun.password.hash(input.password)
            const [row] = await drizzle
                .insert(users)
                .values({
                    email: input.email.toLowerCase(),
                    passwordHash,
                    roles: input.roles,
                })
                .returning()
            return rowToUser(row!)
        },

        async verifyPassword(
            email: string,
            password: string,
        ): Promise<AuthUser | null> {
            const u = await this.findUserByEmail(email)
            if (!u) return null
            const ok = await Bun.password.verify(password, u.passwordHash)
            return ok ? u : null
        },

        async createSession(userId: string, ttlMs: number): Promise<Session> {
            const expiresAt = new Date(Date.now() + ttlMs)
            const [row] = await drizzle
                .insert(sessions)
                .values({ userId, expiresAt })
                .returning()
            return row!
        },

        async findSession(id: string): Promise<Session | null> {
            const rows = await drizzle
                .select()
                .from(sessions)
                .where(eq(sessions.id, id))
                .limit(1)
            const row = rows[0]
            if (!row) return null
            if (row.expiresAt.getTime() <= Date.now()) {
                await this.deleteSession(id)
                return null
            }
            return row
        },

        async deleteSession(id: string): Promise<void> {
            await drizzle.delete(sessions).where(eq(sessions.id, id))
        },
    }
}

export type AuthService = ReturnType<typeof createAuthService>

type UserRow = typeof users.$inferSelect

function rowToUser(row: UserRow): AuthUser {
    return {
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        roles: row.roles,
        permissionGrants: row.permissionGrants ?? undefined,
        permissionDenies: row.permissionDenies ?? undefined,
        createdAt: row.createdAt,
    }
}
