import { renderMetaTags } from './meta'
import type { JsxElement, LayoutComponent, LayoutProps } from './types'

/**
 * Identity helper — preserves the layout's signature for IDE hovers and the
 * file-route system. Mirrors `defineMeta` / `defineConfig` for consistency.
 */
export function defineLayout(layout: LayoutComponent): LayoutComponent {
    return layout
}

/**
 * The default HTML shell used when a page declares no `layout`. Minimal on
 * purpose — apps will replace it with their own. Emits `<html>`+`<head>`+`<body>`
 * with the page's meta tags injected.
 */
export const RootLayout: LayoutComponent = ({
    children,
    meta,
}: LayoutProps): JsxElement => (
    <html lang="en">
        <head>{renderMetaTags(meta)}</head>
        <body>{children}</body>
    </html>
)
