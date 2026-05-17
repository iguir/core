/**
 * Shared types for the first-party auth module. Kept separate from
 * `index.ts` so contracts/stores/middleware can import them without a cycle.
 */

/** What the auth module persists per user. Apps extend via the store layer. */
export interface AuthUser {
    id: string
    email: string
    passwordHash: string
    roles: string[]
    permissionGrants?: string[]
    permissionDenies?: string[]
    createdAt: Date
}

/** Safe-for-API projection — never includes `passwordHash`. */
export interface PublicUser {
    id: string
    email: string
    roles: string[]
    createdAt: string
}

/** Convert internal user → API shape. Centralised so `passwordHash` can't leak. */
export function toPublicUser(u: AuthUser): PublicUser {
    return {
        id: u.id,
        email: u.email,
        roles: [...u.roles],
        createdAt: u.createdAt.toISOString(),
    }
}

/** A session row. `expiresAt` lets stores enforce TTLs without timers. */
export interface Session {
    id: string
    userId: string
    createdAt: Date
    expiresAt: Date
}
