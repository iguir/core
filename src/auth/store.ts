import type { AuthUser, Session } from './types'

/**
 * Persistence boundary for users. The framework ships an in-memory impl;
 * apps wire a Drizzle-backed one via `@iguir/db` when they're ready.
 */
export interface UserStore {
    findById(id: string): Promise<AuthUser | null>
    findByEmail(email: string): Promise<AuthUser | null>
    create(user: Omit<AuthUser, 'id' | 'createdAt'> & { id?: string }): Promise<AuthUser>
}

/**
 * Persistence boundary for sessions. Sessions are opaque random tokens
 * stored server-side; clients only ever see the id (via cookie).
 */
export interface SessionStore {
    create(userId: string, ttlMs: number): Promise<Session>
    findById(id: string): Promise<Session | null>
    delete(id: string): Promise<void>
    deleteAllForUser(userId: string): Promise<void>
}

/** In-memory user store. Good for tests and small dev runs. */
export class MemoryUserStore implements UserStore {
    private readonly byId = new Map<string, AuthUser>()
    private readonly byEmail = new Map<string, string>()

    async findById(id: string): Promise<AuthUser | null> {
        return this.byId.get(id) ?? null
    }

    async findByEmail(email: string): Promise<AuthUser | null> {
        const id = this.byEmail.get(email.toLowerCase())
        return id ? (this.byId.get(id) ?? null) : null
    }

    async create(
        input: Omit<AuthUser, 'id' | 'createdAt'> & { id?: string },
    ): Promise<AuthUser> {
        const email = input.email.toLowerCase()
        if (this.byEmail.has(email)) {
            throw new Error(`[auth] user with email "${email}" already exists`)
        }
        const user: AuthUser = {
            ...input,
            email,
            id: input.id ?? crypto.randomUUID(),
            createdAt: new Date(),
        }
        this.byId.set(user.id, user)
        this.byEmail.set(email, user.id)
        return user
    }
}

/** In-memory session store. Good for tests and single-process dev runs. */
export class MemorySessionStore implements SessionStore {
    private readonly byId = new Map<string, Session>()

    async create(userId: string, ttlMs: number): Promise<Session> {
        const now = Date.now()
        const session: Session = {
            id: crypto.randomUUID(),
            userId,
            createdAt: new Date(now),
            expiresAt: new Date(now + ttlMs),
        }
        this.byId.set(session.id, session)
        return session
    }

    async findById(id: string): Promise<Session | null> {
        const s = this.byId.get(id)
        if (!s) return null
        if (s.expiresAt.getTime() <= Date.now()) {
            this.byId.delete(id)
            return null
        }
        return s
    }

    async delete(id: string): Promise<void> {
        this.byId.delete(id)
    }

    async deleteAllForUser(userId: string): Promise<void> {
        for (const [id, s] of this.byId) {
            if (s.userId === userId) this.byId.delete(id)
        }
    }
}
