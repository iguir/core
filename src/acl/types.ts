/** How a permission is enforced. */
export type AclMode = 'strict' | 'flexible'

/** A role declaration in the app-level role registry. */
export type RoleDefinition = {
    description: string
    /** System roles cannot be deleted from admin UIs. */
    system?: boolean
}

/** A map of role name → definition. */
export type Roles<TNames extends string = string> = Record<TNames, RoleDefinition>

/**
 * Per-role default permission grants for one module.
 * Values must be permissions declared in the same ACL, or the '*' wildcard
 * (which means "all permissions in this module").
 */
export type AclDefaults<TRoles extends string, TPerms extends string> = {
    [K in TRoles]?: readonly (TPerms | '*')[]
}

/** The full ACL specification for a single module. */
export type AclSpec<
    TModule extends string = string,
    TPerms extends readonly string[] = readonly string[],
    TRoles extends string = string,
> = {
    module: TModule
    permissions: TPerms
    defaults: AclDefaults<TRoles, TPerms[number]>
    modes?: Partial<Record<TPerms[number], AclMode>>
    defaultMode?: AclMode
}

/** What the resolver expects from an authenticated subject. */
export type AclSubject = {
    roles: readonly string[]
    permissionGrants?: readonly string[]
    permissionDenies?: readonly string[]
}

/** Information about a single permission, recorded at registry build time. */
export type PermissionInfo = {
    permission: string
    module: string
    mode: AclMode
}

/** Compiled, query-ready ACL data — produced once at bootstrap, read on every request. */
export type CompiledAcl = {
    permissions: ReadonlyMap<string, PermissionInfo>
    roleGrants: ReadonlyMap<string, ReadonlySet<string>>
    roles: Readonly<Roles>
}