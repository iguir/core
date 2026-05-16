import { Fragment } from 'hono/jsx'
import type { JsxElement, PageMeta } from './types'

/**
 * Identity helper — preserves literal-type inference for `meta` so
 * downstream consumers see the exact shape, not the widened union.
 *
 *   export const meta = defineMeta({ title: 'Hello' })
 */
export function defineMeta<const T extends PageMeta>(meta: T): T {
    return meta
}

/**
 * Merge a base meta with overrides. Used by the renderer to combine page +
 * static-from-entry meta with loader-derived dynamic meta.
 */
export function mergeMeta(
    base: PageMeta | undefined,
    ...overrides: (PageMeta | undefined)[]
): PageMeta {
    const out: PageMeta = { ...(base ?? {}) }
    for (const o of overrides) {
        if (!o) continue
        // Capture nested fields before Object.assign overwrites them — we
        // want deep-merge for `og`/`twitter` and concat for `links`/`scripts`/`extra`.
        const priorOg = out.og
        const priorTwitter = out.twitter
        const priorLinks = out.links
        const priorScripts = out.scripts
        const priorExtra = out.extra
        Object.assign(out, o)
        if (o.og || priorOg) out.og = { ...(priorOg ?? {}), ...(o.og ?? {}) }
        if (o.twitter || priorTwitter)
            out.twitter = { ...(priorTwitter ?? {}), ...(o.twitter ?? {}) }
        if (o.links || priorLinks)
            out.links = [...(priorLinks ?? []), ...(o.links ?? [])]
        if (o.scripts || priorScripts)
            out.scripts = [...(priorScripts ?? []), ...(o.scripts ?? [])]
        if (o.extra || priorExtra)
            out.extra = [...(priorExtra ?? []), ...(o.extra ?? [])]
    }
    return out
}

/**
 * Render every meta entry as the JSX fragment that belongs in `<head>`.
 * Layouts call this so the boilerplate (charset, viewport, title, og:*, …) is
 * generated consistently.
 */
export function renderMetaTags(meta: PageMeta): JsxElement {
    return (
        <Fragment>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            {meta.title ? <title>{meta.title}</title> : null}
            {meta.description ? (
                <meta name="description" content={meta.description} />
            ) : null}

            {meta.og?.title ? (
                <meta property="og:title" content={meta.og.title} />
            ) : null}
            {meta.og?.description ? (
                <meta property="og:description" content={meta.og.description} />
            ) : null}
            {meta.og?.image ? <meta property="og:image" content={meta.og.image} /> : null}
            {meta.og?.type ? <meta property="og:type" content={meta.og.type} /> : null}
            {meta.og?.url ? <meta property="og:url" content={meta.og.url} /> : null}

            {meta.twitter?.card ? (
                <meta name="twitter:card" content={meta.twitter.card} />
            ) : null}
            {meta.twitter?.site ? (
                <meta name="twitter:site" content={meta.twitter.site} />
            ) : null}
            {meta.twitter?.creator ? (
                <meta name="twitter:creator" content={meta.twitter.creator} />
            ) : null}

            {(meta.links ?? []).map((l) => (
                <link
                    rel={l.rel}
                    href={l.href}
                    type={l.type}
                    sizes={l.sizes}
                    {...(l.crossorigin ? { crossorigin: l.crossorigin } : {})}
                />
            ))}
            {(meta.extra ?? []).map((m) => (
                <meta name={m.name} property={m.property} content={m.content} />
            ))}
            {(meta.scripts ?? []).map((s) =>
                s.content ? (
                    <script
                        src={s.src}
                        type={s.type}
                        defer={s.defer}
                        async={s.async}
                        dangerouslySetInnerHTML={{ __html: s.content }}
                    />
                ) : (
                    <script
                        src={s.src}
                        type={s.type}
                        defer={s.defer}
                        async={s.async}
                    />
                ),
            )}
        </Fragment>
    )
}
