import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
    assertValidModuleName,
    filePathToRouteKey,
} from './path-map'
import type {
    DiscoveredPage,
    PagesByModule,
    ResolvedIguirOptions,
} from './types'

/**
 * Walk every `<modulesDir>/<module>/<pagesDir>/**` directory and return a map
 * of module → page entries. Pure: no Vite dependency, easy to unit-test.
 */
export function scanPages(opts: ResolvedIguirOptions): PagesByModule {
    const out = new Map<string, DiscoveredPage[]>()
    const modulesAbs = resolve(opts.root, opts.modulesDir)
    if (!existsSync(modulesAbs)) return out

    for (const moduleName of readdirSync(modulesAbs)) {
        const modulePath = join(modulesAbs, moduleName)
        if (!statSync(modulePath).isDirectory()) continue

        assertValidModuleName(moduleName)
        const pagesPath = join(modulePath, opts.pagesDir)
        if (!existsSync(pagesPath)) continue

        const pages: DiscoveredPage[] = []
        walk(pagesPath, (absolutePath) => {
            if (!opts.pageExtensions.some((ext) => absolutePath.endsWith(ext))) {
                return
            }
            const relInsidePages = relative(pagesPath, absolutePath)
            const routeKey = filePathToRouteKey(relInsidePages, opts.pageExtensions)
            pages.push({
                module: moduleName,
                routeKey,
                absolutePath,
                relativePath: relative(opts.root, absolutePath),
            })
        })

        if (pages.length > 0) {
            pages.sort((a, b) => a.routeKey.localeCompare(b.routeKey))
            out.set(moduleName, pages)
        }
    }

    return out
}

function walk(dir: string, visit: (file: string) => void): void {
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry)
        const s = statSync(p)
        if (s.isDirectory()) walk(p, visit)
        else if (s.isFile()) visit(p)
    }
}

/**
 * Resolve user-supplied options with the standard defaults. Centralised so
 * the plugin and every test instantiates the same shape.
 */
export function resolveOptions(
    input: {
        modulesDir?: string
        pagesDir?: string
        pageExtensions?: readonly string[]
        root?: string
    } = {},
): ResolvedIguirOptions {
    return {
        modulesDir: input.modulesDir ?? 'src/modules',
        pagesDir: input.pagesDir ?? 'pages',
        pageExtensions: input.pageExtensions ?? ['.tsx'],
        root: input.root ?? process.cwd(),
    }
}
