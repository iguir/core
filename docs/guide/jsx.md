# JSX, pages & islands

Server-rendered pages with `hono/jsx`. Selective client hydration via islands. Both wired up by `@iguir/core/vite-plugin` when present.

## Page files

Files under `src/modules/<name>/pages/**/*.tsx` become routes. Vite plugin discovers them; `mountPages()` consumes the manifest.

```tsx
// src/modules/blog/pages/posts/[id].tsx
import { type PageProps } from '@iguir/core/jsx'
import { NotFoundError } from '@iguir/core/errors'

export const meta = { title: 'Post' }

export async function loader(c) {
    const post = await db.posts.find(c.req.param('id'))
    if (!post) throw new NotFoundError()
    return { post }
}

export default function Page({ data, params }: PageProps<typeof loader>) {
    return (
        <article>
            <h1>{data.post.title}</h1>
            <p>{data.post.body}</p>
        </article>
    )
}

export const layout = MyCustomLayout                // optional
```

| Export | Required? | Type |
|---|---|---|
| `default` | ✅ | `(props: PageProps<typeof loader>) => JSX.Element` |
| `loader` | optional | `(c: Context) => any` — return data, or throw `NotFoundError` / `RedirectError` |
| `meta` | optional | `PageMeta` or `(data) => PageMeta` |
| `layout` | optional | `LayoutComponent` — overrides the default `RootLayout` |

## File-routing conventions

Page filename → route key:

| File | Route |
|---|---|
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `posts/[id].tsx` | `/posts/:id` |
| `posts/[id]/edit.tsx` | `/posts/:id/edit` |
| `files/[...rest].tsx` | `/files/*` (catch-all) |
| `posts/[[opt]].tsx` | `/posts/:opt?` (optional) |

Mounted under your module's `prefix`:

```ts
import { pages } from 'virtual:iguir-pages/blog'

defineModule({
    name: 'blog',
    pages: { manifest: pages, prefix: '/blog' },
})
```

## Layouts

The default layout (`RootLayout`) is a minimal `<html><head><body>` shell. Override per page or build your own:

```tsx
import { defineLayout, renderMetaTags } from '@iguir/core/jsx'

export const layout = defineLayout(({ children, meta }) => (
    <html lang="en">
        <head>
            {renderMetaTags(meta)}
            <link rel="stylesheet" href="/main.css" />
            <script type="module" src="/iguir-islands.js" />
        </head>
        <body>
            <nav>...</nav>
            <main>{children}</main>
        </body>
    </html>
))
```

`renderMetaTags(meta)` emits the full `<head>` boilerplate (charset, viewport, title, og:*, twitter:*, links, scripts, extras).

## Meta

```ts
import { defineMeta } from '@iguir/core/jsx'

export const meta = defineMeta({
    title: 'Hello',
    description: '...',
    og: { image: '/og.png', type: 'article' },
    twitter: { card: 'summary_large_image' },
    links: [{ rel: 'canonical', href: 'https://example.com/posts/1' }],
})
```

Dynamic meta from loader data:

```ts
export const loader = async (c) => ({ post: ... })
export const meta = (data) => ({
    title: data.post.title,
    description: data.post.excerpt,
})
```

## Islands

Islands are interactive components that run on both server (SSR) and client (hydrated). Use them for the parts of a page that need JS — keep the rest pure HTML.

```tsx
// src/modules/blog/islands/Counter.tsx
import { defineIsland } from '@iguir/core/jsx'
import { useState } from 'hono/jsx'

export const Counter = defineIsland('Counter', ({ initial = 0 }) => {
    const [n, setN] = useState(initial)
    return <button onClick={() => setN(n + 1)}>Count: {n}</button>
})
```

Use inside any page or component:

```tsx
import { Counter } from '../islands/Counter'

export default function Page() {
    return (
        <main>
            <h1>Demo</h1>
            <Counter initial={5} />
        </main>
    )
}
```

How it works:

1. Server renders `<iguir-island data-name="Counter" data-props='{"initial":5}'>{ssrHTML}</iguir-island>`.
2. On the client, `virtual:iguir-islands` finds every such element, looks up the component, and rehydrates it with `render()` from `hono/jsx/dom`.
3. If JS fails to load, the SSR'd HTML still renders. Graceful degradation by default.

Island props must be JSON-serializable. Functions and `Date` won't survive — use serializable shapes only.

## Plugin setup

Create-iguir scaffolds this for you. By hand:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import iguir from '@iguir/core/vite-plugin'

export default defineConfig({
    plugins: [iguir()],
})
```

Then in your root layout, include the islands client:

```tsx
<script type="module" src="/virtual:iguir-islands" />
```

Run with `iguir dev` — it spawns both Bun and Vite. Build with `iguir build` — it runs Vite client build, then Bun server bundle.

→ Next: [Auth](./auth).
