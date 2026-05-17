/**
 * Convert a file path inside `pages/` to the route key understood by
 * `mountPages()`. Mirrors Next-style file-routing conventions:
 *
 *   pages/index.tsx              → "index"
 *   pages/about.tsx              → "about"
 *   pages/posts/[id].tsx         → "posts/[id]"
 *   pages/posts/[id]/edit.tsx    → "posts/[id]/edit"
 *   pages/files/[...rest].tsx    → "files/[...rest]"
 *   pages/posts/[[opt]].tsx      → "posts/[[opt]]"
 *
 * The route key keeps its bracket syntax — `mountPages()` translates that to
 * Hono's `:slug` form at mount time, so both layers share one source of truth.
 */
export function filePathToRouteKey(
    relativeToPagesDir: string,
    extensions: readonly string[],
): string {
    let key = relativeToPagesDir.replace(/\\/g, '/')
    // Strip a leading slash if present (defensive — `relative()` shouldn't add one).
    key = key.replace(/^\/+/, '')
    // Strip the extension.
    for (const ext of extensions) {
        if (key.endsWith(ext)) {
            key = key.slice(0, -ext.length)
            break
        }
    }
    if (key === '') key = 'index'
    return key
}

/** Inverse helper — for diagnostics. */
export function routeKeyToHonoPath(key: string): string {
    let p = key
    if (!p.startsWith('/')) p = '/' + p
    p = p.replace(/\/index$/, '') || '/'
    p = p.replace(/\[\.\.\.[^\]]+\]/g, '*')
    p = p.replace(/\[\[([^\]]+)\]\]/g, ':$1?')
    p = p.replace(/\[([^\]]+)\]/g, ':$1')
    return p
}

const MODULE_NAME_RE = /^[a-z][a-z0-9_]*$/

/** Validate a module folder name. Throws to make misconfig loud at startup. */
export function assertValidModuleName(name: string): void {
    if (!MODULE_NAME_RE.test(name)) {
        throw new Error(
            `[iguir-vite] module folder "${name}" is invalid. ` +
                'Use lowercase letters, digits, and underscores; must start with a letter.',
        )
    }
}
