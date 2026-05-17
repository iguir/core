import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { createErrorHandler } from '../../errors/handler'
import { mountPages } from '../file'
import type { PageManifest } from '../../jsx/types'

function wrap(manifest: PageManifest, prefix = '/'): Hono {
    const app = new Hono()
    app.onError(createErrorHandler({}))
    app.route(prefix, mountPages(manifest))
    return app
}

describe('mountPages', () => {
    test('index file mounts at /', async () => {
        const app = wrap({
            'index': { component: () => <h1>home</h1> },
        })
        const res = await app.request('/')
        expect(res.status).toBe(200)
        expect(await res.text()).toContain('<h1>home</h1>')
    })

    test('converts [slug] to :slug; params land in component', async () => {
        const app = wrap({
            'posts/[id]': {
                component: ({ params }) => <p>{params.id}</p>,
            },
        })
        const res = await app.request('/posts/42')
        expect(res.status).toBe(200)
        expect(await res.text()).toContain('<p>42</p>')
    })

    test('catch-all [...rest] maps to wildcard', async () => {
        const app = wrap({
            'files/[...rest]': {
                component: () => <p>caught</p>,
            },
        })
        const res = await app.request('/files/a/b/c')
        expect(res.status).toBe(200)
        expect(await res.text()).toContain('<p>caught</p>')
    })

    test('lazy entries are loaded on first request and cached', async () => {
        let loadCount = 0
        const app = wrap({
            'lazy': async () => {
                loadCount++
                return {
                    component: () => <p>lazy</p>,
                }
            },
        })
        await app.request('/lazy')
        await app.request('/lazy')
        expect(loadCount).toBe(1)
    })

    test('prefix nesting works via app.route', async () => {
        const app = wrap(
            {
                'index': { component: () => <h1>blog home</h1> },
                'posts/[id]': {
                    component: ({ params }) => <p>{params.id}</p>,
                },
            },
            '/blog',
        )
        expect((await app.request('/blog')).status).toBe(200)
        expect(await (await app.request('/blog/posts/7')).text()).toContain('<p>7</p>')
    })

    test('manifest must be an object', () => {
        // @ts-expect-error
        expect(() => mountPages(null)).toThrow(/manifest must be an object/)
    })

    test('entry without a component fails with an actionable message', async () => {
        const app = wrap({
            // biome-ignore lint/suspicious/noExplicitAny: testing runtime validation
            'broken': { meta: { title: 'x' } } as any,
        })
        const res = await app.request('/broken')
        expect(res.status).toBe(500)
        const body = (await res.json()) as { error: { message: string } }
        expect(body.error.message).toMatch(/missing a component/)
    })
})
