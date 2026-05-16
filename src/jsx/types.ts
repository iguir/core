import type { Context } from 'hono'
import type { HtmlEscapedString } from 'hono/utils/html'

/**
 * A JSX element produced by `hono/jsx`. We alias it locally so downstream
 * code never has to reach into `hono/jsx`'s internal namespace path.
 */
export type JsxElement = HtmlEscapedString | Promise<HtmlEscapedString> | string | null

/** Per-page metadata. Serialised into the HTML `<head>` by the layout. */
export interface PageMeta {
    title?: string
    description?: string
    /** Open-Graph tags. */
    og?: {
        title?: string
        description?: string
        image?: string
        type?: string
        url?: string
    }
    /** Twitter card tags. */
    twitter?: {
        card?: 'summary' | 'summary_large_image'
        site?: string
        creator?: string
    }
    /** Extra `<link>` tags (canonical, alternate, icons, …). */
    links?: ReadonlyArray<{
        rel: string
        href: string
        type?: string
        sizes?: string
        crossorigin?: 'anonymous' | 'use-credentials'
    }>
    /** Extra `<script>` tags. Use sparingly — prefer islands. */
    scripts?: ReadonlyArray<{
        src?: string
        content?: string
        type?: string
        defer?: boolean
        async?: boolean
    }>
    /** Extra raw `<meta>` tags by name/property. */
    extra?: ReadonlyArray<{ name?: string; property?: string; content: string }>
}

/** A loader pulls data for a page. Throw `NotFoundError` / `RedirectError` to short-circuit. */
export type Loader<TData = unknown> = (
    c: Context,
) => TData | Promise<TData>

/** Awaited result of a loader. */
export type LoaderResult<TLoader> = TLoader extends Loader<infer T>
    ? Awaited<T>
    : TLoader extends (c: Context) => infer R
      ? Awaited<R>
      : undefined

/** Props a page component receives. Generic over `typeof loader`. */
export interface PageProps<TLoader = undefined> {
    data: LoaderResult<TLoader>
    meta: PageMeta
    params: Readonly<Record<string, string>>
    /** The raw request context, for advanced use. */
    c: Context
}

/** A page component renders the body for a route. */
export type PageComponent<TLoader = undefined> = (
    props: PageProps<TLoader>,
) => JsxElement | Promise<JsxElement>

/** Layouts wrap a page in a shell — usually `<html>`+`<head>`+`<body>`. */
export interface LayoutProps {
    children: JsxElement
    meta: PageMeta
    params: Readonly<Record<string, string>>
}

/** A layout component receives the rendered page as `children`. */
export type LayoutComponent = (props: LayoutProps) => JsxElement | Promise<JsxElement>

/**
 * One file-routed page: the component + optional loader + optional meta +
 * optional layout. Plugin produces this shape per file; users can also
 * write it by hand in tests.
 */
export interface PageEntry<TLoader extends Loader | undefined = Loader | undefined> {
    component: PageComponent<TLoader>
    loader?: TLoader
    meta?: PageMeta | ((data: LoaderResult<TLoader>) => PageMeta)
    layout?: LayoutComponent
}

/**
 * Map of route path → page entry. Keys use Next-style brackets for dynamic
 * params (`/posts/[id]`), which are converted to Hono's `:param` form at
 * mount time. Lazy entries (`() => Promise<PageEntry>`) are supported so the
 * vite-plugin can emit code-split imports.
 */
export type PageManifest = Record<
    string,
    PageEntry | (() => Promise<PageEntry | { default: PageEntry }>)
>
