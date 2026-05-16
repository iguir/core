import { describe, expect, test } from 'bun:test'
import { defineMeta, mergeMeta, renderMetaTags } from '../meta'

async function renderToString(node: unknown): Promise<string> {
    if (node == null) return ''
    if (typeof node === 'string') return node
    if (node instanceof Promise) return renderToString(await node)
    const ts = (node as { toString?: () => string | Promise<string> }).toString
    if (typeof ts === 'function') {
        const out = ts.call(node)
        return out instanceof Promise ? await out : out
    }
    return String(node)
}

describe('defineMeta', () => {
    test('preserves literal-type inference', () => {
        const m = defineMeta({ title: 'Hello', description: 'World' })
        expect(m.title).toBe('Hello')
        expect(m.description).toBe('World')
    })
})

describe('mergeMeta', () => {
    test('shallow-merges top-level fields and nested og/twitter', () => {
        const merged = mergeMeta(
            { title: 'A', og: { title: 'A-og', type: 'website' } },
            { title: 'B', og: { description: 'B-og-desc' } },
        )
        expect(merged.title).toBe('B')
        expect(merged.og?.title).toBe('A-og')
        expect(merged.og?.description).toBe('B-og-desc')
        expect(merged.og?.type).toBe('website')
    })

    test('concatenates links/scripts/extra arrays', () => {
        const merged = mergeMeta(
            { links: [{ rel: 'canonical', href: '/a' }] },
            { links: [{ rel: 'alternate', href: '/b' }] },
        )
        expect(merged.links?.length).toBe(2)
    })
})

describe('renderMetaTags', () => {
    test('always emits charset + viewport', async () => {
        const html = await renderToString(renderMetaTags({}))
        expect(html).toContain('charset="utf-8"')
        expect(html).toContain('viewport')
    })

    test('renders title and description when present', async () => {
        const html = await renderToString(
            renderMetaTags({ title: 'Hi', description: 'There' }),
        )
        expect(html).toContain('<title>Hi</title>')
        expect(html).toContain('name="description"')
        expect(html).toContain('content="There"')
    })

    test('renders og + twitter tags', async () => {
        const html = await renderToString(
            renderMetaTags({
                og: { title: 'OG', image: 'https://x/y.png' },
                twitter: { card: 'summary_large_image', site: '@x' },
            }),
        )
        expect(html).toContain('property="og:title"')
        expect(html).toContain('https://x/y.png')
        expect(html).toContain('twitter:card')
        expect(html).toContain('@x')
    })

    test('renders link, extra meta, and script entries', async () => {
        const html = await renderToString(
            renderMetaTags({
                links: [
                    { rel: 'canonical', href: 'https://x/' },
                    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
                ],
                extra: [{ name: 'robots', content: 'index,follow' }],
                scripts: [
                    { src: '/main.js', type: 'module', defer: true },
                    { content: 'console.log(1)' },
                ],
            }),
        )
        expect(html).toContain('rel="canonical"')
        expect(html).toContain('href="https://x/"')
        expect(html).toContain('image/svg+xml')
        expect(html).toContain('robots')
        expect(html).toContain('src="/main.js"')
        expect(html).toContain('console.log(1)')
    })

    test('escapes dangerous strings in user-supplied content', async () => {
        const html = await renderToString(
            renderMetaTags({
                title: '<script>alert(1)</script>',
                description: '" onload="alert(1)',
            }),
        )
        expect(html).not.toContain('<script>alert(1)</script>')
        expect(html).toContain('&lt;script&gt;')
    })
})
