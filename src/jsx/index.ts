/**
 * Public surface for the JSX/SSR layer.
 *
 *   import { defineMeta, defineLayout, defineIsland, type PageProps } from '@iguir/core/jsx'
 *
 * The runtime ships here; the build-time piece (file scanning, JSX bundling,
 * client-side island hydration) lives in `@iguir/vite-plugin`.
 */

export { defineMeta, mergeMeta, renderMetaTags } from './meta'
export { defineLayout, RootLayout } from './layout'
export { defineIsland, getDeclaredIslands, type IslandRecord } from './islands'
export { renderPage } from './renderer'
export type {
    Loader,
    LoaderResult,
    PageComponent,
    PageEntry,
    PageManifest,
    PageMeta,
    PageProps,
    LayoutComponent,
    LayoutProps,
} from './types'
