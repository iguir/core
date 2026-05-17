/**
 * Options for the iguir Vite plugin. Sensible defaults match the
 * `create-iguir` scaffold; apps can override every directory if needed.
 */
export interface IguirPluginOptions {
    /**
     * Root containing module folders. Each subdirectory of `modulesDir` is
     * treated as one module. Defaults to `src/modules`.
     */
    modulesDir?: string
    /**
     * Subdirectory within a module that holds page files. Defaults to `pages`.
     */
    pagesDir?: string
    /**
     * File extensions considered pages. Defaults to `.tsx`. We deliberately
     * exclude `.ts` so non-component files (utils, types) under `pages/` don't
     * pollute the manifest.
     */
    pageExtensions?: readonly string[]
    /**
     * Project root. Defaults to Vite's config root (usually `process.cwd()`).
     * Exposed so tests can run with a fixture root.
     */
    root?: string
}

/** Resolved options with defaults applied. Internal. */
export interface ResolvedIguirOptions {
    modulesDir: string
    pagesDir: string
    pageExtensions: readonly string[]
    root: string
}

/** One discovered page file. */
export interface DiscoveredPage {
    /** Module this page belongs to (folder under `modulesDir`). */
    module: string
    /** Route key as `mountPages` understands it (e.g. `'posts/[id]'`, `'index'`). */
    routeKey: string
    /** Absolute path to the .tsx file. */
    absolutePath: string
    /** Path relative to the project root (used for imports). */
    relativePath: string
}

/** Map of module name → discovered pages. */
export type PagesByModule = ReadonlyMap<string, readonly DiscoveredPage[]>

/** Virtual module name prefix used by the plugin. */
export const VIRTUAL_PAGES_PREFIX = 'virtual:iguir-pages/'
export const VIRTUAL_ISLANDS_ID = 'virtual:iguir-islands'
