import { defineCommand } from 'citty'
import type { AclSpec } from '../../acl/types'
import { AclRegistry } from '../../acl/registry'
import { resolveAppConfig } from '../resolve-config'
import { c, table } from '../format'

export const aclCommand = defineCommand({
    meta: {
        name: 'acl',
        description: 'Inspect roles, permissions, and role → permission grants.',
    },
    args: {
        config: {
            type: 'string',
            description: 'Path to app.config.ts (auto-discovered if omitted).',
        },
        role: {
            type: 'string',
            description: 'Show permissions granted to this role only.',
        },
        permission: {
            type: 'string',
            description: 'Show which roles hold this permission.',
        },
        json: {
            type: 'boolean',
            description: 'Emit JSON instead of tables.',
            default: false,
        },
    },
    async run({ args }) {
        const { config } = await resolveAppConfig({ explicit: args.config })

        const moduleAcls = config.modules
            .map((m) => m.acl)
            .filter((a): a is AclSpec => a !== undefined)
        const registry = new AclRegistry(config.roles, moduleAcls)

        // Single-role drill-down.
        if (args.role) {
            const perms = registry.permissionsForRole(args.role)
            if (args.json) {
                console.log(JSON.stringify({ role: args.role, permissions: perms }, null, 2))
                return
            }
            printSingleRole(args.role, perms, registry)
            return
        }

        // Single-permission drill-down.
        if (args.permission) {
            const roles = registry.rolesForPermission(args.permission)
            if (args.json) {
                console.log(
                    JSON.stringify({ permission: args.permission, roles }, null, 2),

                )
                return
            }
            printSinglePermission(args.permission, roles, registry)
            return
        }

        // Full dump.
        if (args.json) {
            console.log(JSON.stringify(buildJsonDump(registry), null, 2))
            return
        }
        printFullDump(registry)
    },
})

function printSingleRole(
    role: string,
    perms: readonly string[],
    registry: AclRegistry,
): void {
    const def = registry.roleDefinition(role)
    if (!def) {
        console.error(c.red(`role "${role}" is not declared`))
        console.error(c.dim(`Known roles: ${registry.allRoles().join(', ')}`))
        process.exit(1)
    }
    console.log(c.bold(role) + c.dim(` — ${def.description}`))
    if (perms.length === 0) {
        console.log(c.dim('  (no permissions granted)'))
        return
    }
    for (const p of perms) console.log(`  ${p}`)
    console.log(c.dim(`\n${perms.length} permissions.`))
}

function printSinglePermission(
    permission: string,
    roles: readonly string[],
    registry: AclRegistry,
): void {
    if (!registry.permissionExists(permission)) {
        console.error(c.red(`permission "${permission}" is not declared`))
        console.error(
            c.dim(
                `Known permissions: ${registry.allPermissions().slice(0, 10).join(', ')}${
                    registry.allPermissions().length > 10 ? ', …' : ''
                }`,
            ),
        )
        process.exit(1)
    }
    const mode = registry.modeOf(permission)
    console.log(c.bold(permission) + c.dim(` (${mode})`))
    if (roles.length === 0) {
        console.log(c.dim('  (no role grants — only explicit user grants in flexible mode can satisfy)'))
        return
    }
    for (const r of roles) console.log(`  ${r}`)
    console.log(c.dim(`\nGranted by ${roles.length} roles.`))
}

function printFullDump(registry: AclRegistry): void {
    // Roles section.
    console.log(c.bold('ROLES'))
    const roleRows: string[][] = [[c.bold('NAME'), c.bold('DESCRIPTION'), c.bold('FLAGS')]]
    for (const name of registry.allRoles()) {
        const def = registry.roleDefinition(name)!
        roleRows.push([c.cyan(name), def.description, def.system ? c.dim('system') : ''])
    }
    console.log(table(roleRows))

    // Permissions section.
    console.log('\n' + c.bold('PERMISSIONS'))
    const permRows: string[][] = [
        [c.bold('PERMISSION'), c.bold('MODULE'), c.bold('MODE'), c.bold('GRANTED TO')],
    ]
    for (const module of registry.allModules()) {
        for (const perm of registry.permissionsForModule(module)) {
            const mode = registry.modeOf(perm) ?? 'flexible'
            const roles = registry.rolesForPermission(perm)
            permRows.push([
                perm,
                c.cyan(module),
                mode === 'strict' ? c.yellow(mode) : c.dim(mode),
                roles.length > 0 ? roles.join(', ') : c.dim('—'),
            ])
        }
    }
    console.log(table(permRows))

    // Summary.
    console.log(
        c.dim(
            `\n${registry.allRoles().length} roles, ${registry.allPermissions().length} permissions, ${registry.allModules().length} modules.`,
        ),
    )
}

function buildJsonDump(registry: AclRegistry) {
    return {
        roles: registry.allRoles().map((name) => ({
            name,
            description: registry.roleDefinition(name)!.description,
            system: registry.roleDefinition(name)!.system ?? false,
            permissions: registry.permissionsForRole(name),
        })),
        permissions: registry.allPermissions().map((p) => ({
            permission: p,
            mode: registry.modeOf(p),
            roles: registry.rolesForPermission(p),
        })),
        modules: registry.allModules().map((m) => ({
            module: m,
            permissions: registry.permissionsForModule(m),
        })),
    }
}
