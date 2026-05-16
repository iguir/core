import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { renderPage } from '../renderer'
import { defineLayout } from '../layout'
import { NotFoundError, RedirectError } from '../../errors/index'
import { createErrorHandler } from '../../errors/handler'
import type { LayoutComponent, PageEntry, PageProps } from '../types'

function mkApp(entry: PageEntry, path = '/') {
    const app = new Hono()
    app.onError(createErrorHandler({}))
    app.get(path, async (c) => renderPage(c, entry, c.req.param()))
    return app
}

describe('renderPage', () => {
    test('static page renders with default RootLayout', async () => {
        const entry: PageEntry = {
            component: () => <main><h1>Hello</h1></main>,
            meta: { title: 'Hello page' },
        }
        const app = mkApp(entry)
        const res = await app.request('/')
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/html')
        const body = await res.text()
        expect(body).toStartWith('<!doctype html>')
        expect(body).toContain('<html lang="en">')
        expect(body).toContain('<title>Hello page</title>')
        expect(body).toContain('<h1>Hello</h1>')
    })

    test('loader data is passed as props', async () => {
        const entry: PageEntry = {
            loader: async () => ({ greeting: 'hey' }),
            component: ({ data }: PageProps<() => Promise<{ greeting: string }>>) => (
                <p>{data.greeting}</p>
            ),
        }
        const app = mkApp(entry)
        const body = await (await app.request('/')).text()
        expect(body).toContain('<p>hey</p>')
    })

    test('dynamic params reach the page via props.params', async () => {
        const entry: PageEntry = {
            component: ({ params }) => <p>{params.id}</p>,
        }
        const app = mkApp(entry, '/posts/:id')
        const body = await (await app.request('/posts/42')).text()
        expect(body).toContain('<p>42</p>')
    })

    test('NotFoundError thrown from the loader yields 404', async () => {
        const entry: PageEntry = {
            loader: () => {
                throw new NotFoundError()
            },
            component: () => <p>never</p>,
        }
        const app = mkApp(entry)
        const res = await app.request('/')
        expect(res.status).toBe(404)
    })

    test('RedirectError thrown from the loader yields 302+Location', async () => {
        const entry: PageEntry = {
            loader: () => {
                throw new RedirectError('/login')
            },
            component: () => <p>never</p>,
        }
        const app = mkApp(entry)
        const res = await app.request('/')
        expect(res.status).toBe(302)
        expect(res.headers.get('location')).toBe('/login')
    })

    test('meta as a function receives loader data', async () => {
        const entry: PageEntry = {
            loader: async () => ({ title: 'Dynamic' }),
            meta: (data) => ({ title: (data as { title: string }).title }),
            component: () => <p>ok</p>,
        }
        const app = mkApp(entry)
        const body = await (await app.request('/')).text()
        expect(body).toContain('<title>Dynamic</title>')
    })

    test('custom layout replaces RootLayout', async () => {
        const CustomLayout: LayoutComponent = defineLayout(({ children }) => (
            <html><body><div id="custom">{children}</div></body></html>
        ))
        const entry: PageEntry = {
            layout: CustomLayout,
            component: () => <p>inside</p>,
        }
        const app = mkApp(entry)
        const body = await (await app.request('/')).text()
        expect(body).toContain('<div id="custom">')
        expect(body).toContain('<p>inside</p>')
        expect(body).not.toContain('viewport') // RootLayout's meta tags not present
    })
})
