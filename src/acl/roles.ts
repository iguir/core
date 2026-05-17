import type { Roles } from './types'

const ROLE_NAME_RE = /^[a-z][a-z0-9_]*$/

/**
 * Define the app-wide role registry. Call this once, in src/app/acl.ts.
 * Throws at module load time if any role is malformed.
 */
export function defineRoles<const T extends Roles>(roles: T): T {
    const names = Object.keys(roles)

    if (names.length === 0) {
        throw new Error('[acl] defineRoles: at least one role must be defined')
    }

    for (const name of names) {
        if (!ROLE_NAME_RE.test(name)) {
            throw new Error(
                `[acl] role name "${name}" is invalid. ` +
                `Use lowercase letters, digits, and underscores; must start with a letter.`
            )
        }

        const def = roles[name]
        if (!def?.description || def.description.trim().length === 0) {
            throw new Error(`[acl] role "${name}" must have a non-empty description`)
        }
    }

    return roles
}

/** Helper: extract the union of role names from a defineRoles result. */
export type RoleNames<T extends Roles> = keyof T & string