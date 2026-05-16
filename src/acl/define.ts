// packages/core/src/acl/define.ts
import type { AclSpec } from './types'

/**
 * Permission format: "module.action" or "module.action.modifier" etc.
 * - lowercase
 * - segments joined by dots
 * - each segment starts with a letter, can contain letters/digits/underscores
 */
const PERM_NAME_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/
const MODULE_NAME_RE = /^[a-z][a-z0-9_]*$/

/**
 * Define a module's permissions and default role mappings.
 * Validates at module load time so typos surface immediately, not at first
 * request after deploy.
 */
export function defineAcl<
    const TModule extends string,
    const TPerms extends readonly string[],
    const TRoles extends string,
>(
    spec: AclSpec<TModule, TPerms, TRoles>,
): AclSpec<TModule, TPerms, TRoles> {
    validate(spec)
    return spec
}

function validate(spec: AclSpec): void {
    const { module, permissions, defaults, modes, defaultMode } = spec
    const tag = `[acl:${module ?? '?'}]`

    // --- module ---
    if (!module || module.trim().length === 0) {
        throw new Error('[acl] defineAcl: `module` is required')
    }
    if (!MODULE_NAME_RE.test(module)) {
        throw new Error(
            `[acl] module name "${module}" is invalid. ` +
            `Use lowercase letters, digits, and underscores; must start with a letter.`,
        )
    }

    // --- permissions ---
    if (!permissions || permissions.length === 0) {
        throw new Error(`${tag} at least one permission must be defined`)
    }

    const prefix = `${module}.`
    const known = new Set<string>()

    for (const perm of permissions) {
        if (!PERM_NAME_RE.test(perm)) {
            throw new Error(
                `${tag} permission "${perm}" has invalid format. ` +
                `Expected "module.action[.modifier]" — lowercase, dot-separated.`,
            )
        }
        if (!perm.startsWith(prefix)) {
            throw new Error(
                `${tag} permission "${perm}" must start with "${prefix}". ` +
                `A module can only declare permissions in its own namespace.`,
            )
        }
        if (known.has(perm)) {
            throw new Error(`${tag} duplicate permission "${perm}"`)
        }
        known.add(perm)
    }

    // --- defaults: every referenced permission must exist (or be '*') ---
    for (const [role, perms] of Object.entries(defaults)) {
        if (!Array.isArray(perms)) {
            throw new Error(`${tag} defaults["${role}"] must be an array of permissions`)
        }
        for (const perm of perms) {
            if (perm === '*') continue
            if (!known.has(perm)) {
                throw new Error(
                    `${tag} role "${role}" references unknown permission "${perm}". ` +
                    `Known: ${[...known].join(', ')}`,
                )
            }
        }
    }

    // --- modes: every referenced permission must exist ---
    if (modes) {
        for (const [perm, mode] of Object.entries(modes)) {
            if (!known.has(perm)) {
                throw new Error(`${tag} mode declared for unknown permission "${perm}"`)
            }
            if (mode !== 'strict' && mode !== 'flexible') {
                throw new Error(
                    `${tag} mode for "${perm}" must be "strict" or "flexible", got "${mode}"`,
                )
            }
        }
    }

    // --- defaultMode ---
    if (
        defaultMode !== undefined &&
        defaultMode !== 'strict' &&
        defaultMode !== 'flexible'
    ) {
        throw new Error(
            `${tag} defaultMode must be "strict" or "flexible", got "${defaultMode}"`,
        )
    }
}