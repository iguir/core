import type { Context } from 'hono'
import { RedirectError, isAppError } from '../errors/index'
import { RootLayout } from './layout'
import { mergeMeta } from './meta'
import type { PageEntry, PageMeta } from './types'

/**
 * Render a page entry into an HTML `Response`. Drives the loader → meta →
 * component → layout pipeline:
 *
 *   1. Run the loader (if any). Errors bubble; the global error handler
 *      will translate `NotFoundError` etc. into JSON. `RedirectError` is
 *      short-circuited here so we never render a page about to be replaced.
 *   2. Compute the final meta (static + loader-derived).
 *   3. Render the page component with `{ data, meta, params, c }`.
 *   4. Wrap in the entry's layout (or `RootLayout` by default).
 *   5. Serialize to a `<!doctype html>…</html>` string.
 */
export async function renderPage(
    c: Context,
    entry: PageEntry,
    params: Readonly<Record<string, string>> = {},
): Promise<Response> {
    let data: unknown
    if (entry.loader) {
        try {
            data = await entry.loader(c)
        } catch (err) {
            if (err instanceof RedirectError) {
                return c.redirect(
                    err.location,
                    err.status as 301 | 302 | 303 | 307 | 308,
                )
            }
            throw err
        }
    }

    let dynamicMeta: PageMeta | undefined
    if (typeof entry.meta === 'function') {
        try {
            dynamicMeta = (entry.meta as (d: unknown) => PageMeta)(data)
        } catch (err) {
            // Re-throw AppErrors so the global handler renders them; otherwise
            // a buggy meta() falls back silently so the page still ships.
            if (isAppError(err)) throw err
            dynamicMeta = undefined
        }
    } else {
        dynamicMeta = entry.meta
    }
    const meta = mergeMeta({}, dynamicMeta)

    const Layout = entry.layout ?? RootLayout
    const PageComp = entry.component
    const body = await PageComp({
        // biome-ignore lint/suspicious/noExplicitAny: loader-derived, user-facing types stay narrow
        data: data as any,
        meta,
        params,
        c,
    })
    const tree = await Layout({ children: body, meta, params })

    const html = await renderToString(tree)

    return new Response(`<!doctype html>${html}`, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
    })
}

/**
 * Coerce hono/jsx's `JsxElement` (which can be a string, Promise, or async
 * generator) into a single string. Streaming SSR is intentionally deferred —
 * the synchronous path is enough until `@iguir/vite-plugin` lands.
 */
async function renderToString(tree: unknown): Promise<string> {
    if (tree == null) return ''
    if (typeof tree === 'string') return tree
    if (typeof tree === 'number' || typeof tree === 'boolean') return String(tree)
    if (tree instanceof Promise) return renderToString(await tree)
    const toString = (tree as { toString?: () => string | Promise<string> }).toString
    if (typeof toString === 'function') {
        const out = toString.call(tree)
        return out instanceof Promise ? await out : out
    }
    return String(tree)
}
