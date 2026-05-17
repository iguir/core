import { defineCommand } from 'citty'
import type { DefinedRoutes } from '../../routing/code'
import { resolveAppConfig } from '../resolve-config'
import { c, table } from '../format'

const METHOD_COLOR: Record<string, (s: string) => string> = {
    GET: c.green,
    POST: c.blue,
    PUT: c.yellow,
    PATCH: c.yellow,
    DELETE: c.red,
    OPTIONS: c.dim,
}

export const routesCommand = defineCommand({
    meta: {
        name: 'routes',
        description: 'Print every declared route across all modules.',
    },
    args: {
        config: {
            type: 'string',
            description: 'Path to app.config.ts (auto-discovered if omitted).',
        },
        json: {
            type: 'boolean',
            description: 'Emit JSON instead of a table.',
            default: false,
        },
    },
    async run({ args }) {
        const { config } = await resolveAppConfig({ explicit: args.config })

        const collected: Array<{
            module: string
            method: string
            path: string
            permission?: string
            auth: boolean
        }> = []

        for (const m of config.modules) {
            if (!m.routes) continue
            const defined = m.routes.handler as unknown as DefinedRoutes
            if (defined.__kind !== 'app:routes') continue

            // declared is filled by build(); for introspection we trigger it lazily.
            if (defined.declared.length === 0) {
                try {
                    await defined.build({} as never)
                } catch {
                    // Builder can throw if a route handler runs at registration
                    // time; declared is still populated up to the failure point.
                }
            }

            const prefix = m.routes.prefix ?? ''
            for (const route of defined.declared) {
                collected.push({
                    module: m.name,
                    method: route.method.toUpperCase(),
                    path: joinPath(prefix, route.path),
                    permission: route.options.permission,
                    auth: !!route.options.auth || !!route.options.permission,
                })
            }
        }

        collected.sort((a, b) =>
            a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
        )

        if (args.json) {
            console.log(JSON.stringify(collected, null, 2))
            return
        }

        if (collected.length === 0) {
            console.log(c.dim('No routes declared.'))
            return
        }

        const rows: string[][] = [
            [c.bold('METHOD'), c.bold('PATH'), c.bold('MODULE'), c.bold('PERMISSION')],
        ]
        for (const r of collected) {
            const m = (METHOD_COLOR[r.method] ?? ((s: string) => s))(r.method)
            const auth = r.auth ? c.dim('🔒 ') : '   '
            rows.push([
                m,
                `${auth}${r.path}`,
                c.cyan(r.module),
                r.permission ?? c.dim('—'),
            ])
        }
        console.log(table(rows))
        console.log(c.dim(`\n${collected.length} routes across ${countModulesWithRoutes(config.modules)} modules.`))
    },
})

function joinPath(prefix: string, path: string): string {
    const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
    if (!p) return path
    if (path === '/' || path === '') return p
    return path.startsWith('/') ? `${p}${path}` : `${p}/${path}`
}

function countModulesWithRoutes(
    modules: readonly { routes?: unknown }[],
): number {
    return modules.filter((m) => m.routes).length
}
