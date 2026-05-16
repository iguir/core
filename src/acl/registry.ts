import type { AclMode, AclSpec, Roles, RoleDefinition } from './types'

/**
 * Built once at bootstrap. Holds the merged, validated, fully-expanded view of
 * every role's permissions plus each permission's enforcement mode.
 *
 * All lookups are O(1) — wildcards are expanded eagerly so the runtime path
 * does no allocation.
 */
export class AclRegistry {
    /** role → set of permissions that role holds (wildcards already expanded) */
    private readonly rolePerms = new Map<string, Set<string>>()

    /** permission → enforcement mode */
    private readonly modes = new Map<string, AclMode>()

    /** module → permissions owned by that module (for wildcard expansion + introspection) */
    private readonly modulePerms = new Map<string, Set<string>>()

    /** every permission known to the app (fast existence check) */
    private readonly allPerms = new Set<string>()

    /** app-level role definitions (description, system flag) */
    private readonly roles: Readonly<Roles>

    constructor(roles: Roles, moduleAcls: readonly AclSpec[]) {
        this.roles = roles
        this.build(moduleAcls)
        Object.freeze(this)
    }

    // ------------------------------------------------------------------
    // build
    // ------------------------------------------------------------------

    private build(moduleAcls: readonly AclSpec[]): void {
        const knownRoles = new Set(Object.keys(this.roles))

        // Pre-populate so every declared role has a (possibly empty) permission set.
        for (const role of knownRoles) {
            this.rolePerms.set(role, new Set())
        }

        for (const acl of moduleAcls) {
            // Module names must be unique across the app.
            if (this.modulePerms.has(acl.module)) {
                throw new Error(
                    `[acl] module "${acl.module}" declared ACL more than once`,
                )
            }

            // Register permissions + modes.
            const owned = new Set<string>()
            this.modulePerms.set(acl.module, owned)
            const defaultMode: AclMode = acl.defaultMode ?? 'flexible'

            for (const perm of acl.permissions) {
                if (this.allPerms.has(perm)) {
                    throw new Error(
                        `[acl] permission "${perm}" is declared by more than one module`,
                    )
                }
                this.allPerms.add(perm)
                owned.add(perm)
                this.modes.set(perm, acl.modes?.[perm] ?? defaultMode)
            }

            // Apply defaults to roles, expanding '*' to the module's full set.
            for (const [role, perms] of Object.entries(acl.defaults)) {
                if (!knownRoles.has(role)) {
                    throw new Error(
                        `[acl:${acl.module}] role "${role}" in defaults is not declared in defineRoles(). ` +
                        `Known roles: ${[...knownRoles].join(', ')}`,
                    )
                }

                const roleSet = this.rolePerms.get(role)!
                for (const perm of perms ?? []) {
                    if (perm === '*') {
                        for (const p of owned) roleSet.add(p)
                    } else {
                        // defineAcl already validated this, but defensive check stays cheap.
                        if (!owned.has(perm)) {
                            throw new Error(
                                `[acl:${acl.module}] role "${role}" references "${perm}" ` +
                                `which is not declared in this module`,
                            )
                        }
                        roleSet.add(perm)
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // hot-path queries (used by resolve())
    // ------------------------------------------------------------------

    hasPermission(role: string, permission: string): boolean {
        return this.rolePerms.get(role)?.has(permission) ?? false
    }

    modeOf(permission: string): AclMode | undefined {
        return this.modes.get(permission)
    }

    permissionExists(permission: string): boolean {
        return this.allPerms.has(permission)
    }

    // ------------------------------------------------------------------
    // introspection (used by `app acl` CLI, admin UIs, tests)
    // ------------------------------------------------------------------

    permissionsForRole(role: string): readonly string[] {
        return [...(this.rolePerms.get(role) ?? [])].sort()
    }

    rolesForPermission(permission: string): readonly string[] {
        const out: string[] = []
        for (const [role, perms] of this.rolePerms) {
            if (perms.has(permission)) out.push(role)
        }
        return out.sort()
    }

    permissionsForModule(module: string): readonly string[] {
        return [...(this.modulePerms.get(module) ?? [])].sort()
    }

    allPermissions(): readonly string[] {
        return [...this.allPerms].sort()
    }

    allRoles(): readonly string[] {
        return Object.keys(this.roles).sort()
    }

    allModules(): readonly string[] {
        return [...this.modulePerms.keys()].sort()
    }

    roleDefinition(role: string): RoleDefinition | undefined {
        return this.roles[role]
    }
}