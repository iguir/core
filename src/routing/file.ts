import { Hono } from 'hono'
import { renderPage } from '../jsx/renderer'
import type { PageEntry, PageManifest } from '../jsx/types'

/**
 * Mount a `PageManifest` onto a fresh Hono sub-app and return it. Caller
 * then does `app.route(prefix, mountPages(manifest))`.
 *
 * Path syntax in manifest keys:
 *   - `[slug]`     → Hono's `:slug` (dynamic segment)
 *   - `[[opt]]`    → `:opt?`         (optional segment)
 *   - `[...rest]`  → `*`             (catch-all)
 *   - `index`      → `/`             (file-route convention)
 *
 * Lazy entries (`() => Promise<PageEntry | { default: PageEntry }>`) are
 * resolved on first request and cached. Lets the vite-plugin emit
 * code-split imports without forcing the runtime to load every page eagerly.
 */
export function mountPages(manifest: PageManifest): Hono {
    if (!manifest || typeof manifest !== 'object') {
        throw new TypeError('[routing] mountPages: manifest must be an object')
    }

    const app = new Hono()

    for (const [rawPath, entryOrLoader] of Object.entries(manifest)) {
        const path = normaliseRoutePath(rawPath)
        const resolveEntry = isLazyEntry(entryOrLoader)
            ? memoise(async () => {
                  const loaded = await entryOrLoader()
                  return 'default' in loaded ? loaded.default : loaded
              })
            : () => Promise.resolve(entryOrLoader)

        app.get(path, async (c) => {
            const entry = await resolveEntry()
            if (!entry || typeof entry.component !== 'function') {
                throw new Error(
                    `[routing] page entry for "${rawPath}" is missing a component. ` +
                        'Each entry must be a { component, loader?, meta?, layout? } object.',
                )
            }
            const params = c.req.param() as Record<string, string>
            return renderPage(c, entry, params)
        })
    }

    return app
}

/** Convert Next-style `[slug]` to Hono's `:slug`. Handles index + optional + catch-all. */
function normaliseRoutePath(input: string): string {
    let p = input.trim()
    if (!p.startsWith('/')) p = '/' + p
    p = p.replace(/\/index$/, '') || '/'
    p = p.replace(/\[\.\.\.[^\]]+\]/g, '*')
    p = p.replace(/\[\[([^\]]+)\]\]/g, ':$1?')
    p = p.replace(/\[([^\]]+)\]/g, ':$1')
    return p
}

function isLazyEntry(
    value: unknown,
): value is () => Promise<PageEntry | { default: PageEntry }> {
    return typeof value === 'function'
}

function memoise<T>(fn: () => Promise<T>): () => Promise<T> {
    let cached: Promise<T> | undefined
    return () => {
        if (!cached) cached = fn()
        return cached
    }
}
