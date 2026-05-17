import { dirname, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { resolveOptions, scanPages } from './page-scanner'
import type { IguirPluginOptions, PagesByModule } from './types'
import { VIRTUAL_ISLANDS_ID, VIRTUAL_PAGES_PREFIX } from './types'
import {
    isVirtualId,
    moduleFromVirtualId,
    renderIslandsClient,
    renderPagesManifest,
} from './virtual-modules'

/**
 * `@iguir/vite-plugin` (colocated in `src/vite-plugin/` until monorepo split).
 *
 * What it does:
 *   1. Discovers pages — `src/modules/<name>/pages/**\/*.tsx` becomes the
 *      virtual module `virtual:iguir-pages/<name>` exporting a `pages` const
 *      that the framework's `mountPages()` consumes.
 *   2. Generates the client-side hydration entry as `virtual:iguir-islands`.
 *      A page or root layout can `<script type="module" src="/virtual:iguir-islands">`
 *      to register every `defineIsland(...)` and hydrate placeholders on load.
 *   3. Invalidates the manifest when pages are added / removed / edited so
 *      Vite's dev server picks up the new shape immediately.
 *
 * The plugin owns the client-side bundle only. The server stays Bun — run it
 * with `bun --hot src/main.ts` as usual; the page virtual modules resolve
 * the same way on either side (Vite for browser, Bun for SSR).
 */
export default function iguir(options: IguirPluginOptions = {}): Plugin {
    const opts = resolveOptions(options)
    let pages: PagesByModule = scanPages(opts)

    const rescan = () => {
        pages = scanPages(opts)
    }

    return {
        name: 'iguir',
        enforce: 'pre',

        configResolved(config) {
            opts.root = config.root
            rescan()
        },

        resolveId(id) {
            if (isVirtualId(id)) {
                // Prefix with \0 — Vite convention: virtual ids start with
                // a null byte so other plugins ignore them.
                return '\0' + id
            }
            return null
        },

        load(rawId) {
            const id = rawId.startsWith('\0') ? rawId.slice(1) : rawId
            if (!isVirtualId(id)) return null

            if (id === VIRTUAL_ISLANDS_ID) {
                return renderIslandsClient(pages)
            }
            const moduleName = moduleFromVirtualId(id)
            if (moduleName == null) return null
            return renderPagesManifest(moduleName, pages)
        },

        // Watch the entire pages root so file additions/deletions trigger HMR.
        configureServer(server) {
            const pagesRoot = resolve(opts.root, opts.modulesDir)
            server.watcher.add(pagesRoot)

            const handleFsChange = (file: string) => {
                if (!isPotentialPageFile(file, opts.modulesDir, opts.pagesDir, opts.pageExtensions)) {
                    return
                }
                rescan()
                // Invalidate every virtual page module. Cheap — there are
                // typically a handful.
                for (const name of pages.keys()) {
                    const mod = server.moduleGraph.getModuleById(
                        '\0' + VIRTUAL_PAGES_PREFIX + name,
                    )
                    if (mod) server.moduleGraph.invalidateModule(mod)
                }
                const islandsMod = server.moduleGraph.getModuleById(
                    '\0' + VIRTUAL_ISLANDS_ID,
                )
                if (islandsMod) server.moduleGraph.invalidateModule(islandsMod)
                server.ws.send({ type: 'full-reload' })
            }

            server.watcher.on('add', handleFsChange)
            server.watcher.on('unlink', handleFsChange)
        },

        handleHotUpdate(ctx) {
            if (
                isPotentialPageFile(
                    ctx.file,
                    opts.modulesDir,
                    opts.pagesDir,
                    opts.pageExtensions,
                )
            ) {
                rescan()
            }
            return undefined
        },
    }
}

/** Is the given absolute path plausibly a page file we care about? */
function isPotentialPageFile(
    file: string,
    modulesDir: string,
    pagesDir: string,
    extensions: readonly string[],
): boolean {
    const normalised = file.replace(/\\/g, '/')
    if (!extensions.some((ext) => normalised.endsWith(ext))) return false
    return (
        normalised.includes(`/${modulesDir}/`) &&
        normalised.includes(`/${pagesDir}/`)
    )
}

// Public re-exports — tests and downstream consumers reach in here.
export type {
    IguirPluginOptions,
    ResolvedIguirOptions,
    DiscoveredPage,
    PagesByModule,
} from './types'
export { VIRTUAL_ISLANDS_ID, VIRTUAL_PAGES_PREFIX } from './types'
export { scanPages, resolveOptions } from './page-scanner'
export {
    renderPagesManifest,
    renderIslandsClient,
} from './virtual-modules'
export { filePathToRouteKey, routeKeyToHonoPath } from './path-map'

void dirname
void relative
