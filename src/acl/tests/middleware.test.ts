import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { defineRoles } from '../roles'
import { defineAcl } from '../define'
import { AclRegistry } from '../registry'
import { aclContext, requirePermission, type AclUser } from '../middleware'

function buildRegistry() {
    const roles = defineRoles({
        admin: { description: 'Admin' },
        editor: { description: 'Editor' },
        viewer: { description: 'Read-only' },
    })

    const postsAcl = defineAcl({
        module: 'posts',
        permissions: ['posts.list', 'posts.create', 'posts.update', 'posts.delete'] as const,
        defaults: {
            admin: ['*'],
            editor: ['posts.list', 'posts.create', 'posts.update'],
            viewer: ['posts.list'],
        },
        modes: { 'posts.delete': 'strict' },
    })

    return new AclRegistry(roles, [postsAcl])
}

function makeApp(registry: AclRegistry, user?: AclUser) {
    const app = new Hono()
    app.use('*', async (c, next) => {
        if (user) c.set('user', user)
        await next()
    })
    app.use('*', aclContext({ registry }))
    return app
}

describe('aclContext', () => {
    test('attaches anonymous checker when no user', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry)
        app.get('/check', (c) => c.json({ can: c.var.can('posts.list') }))

        const res = await app.request('/check')
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ can: false })
    })

    test('attaches authenticated checker with role grants', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry, { roles: ['viewer'] })
        app.get('/check', (c) =>
            c.json({
                list: c.var.can('posts.list'),
                update: c.var.can('posts.update'),
            }),
        )

        const res = await app.request('/check')
        expect(await res.json()).toEqual({ list: true, update: false })
    })
})

describe('requirePermission', () => {
    test('is a no-op when auth is not set', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry)
        app.get('/public', requirePermission({}), (c) => c.text('ok'))

        const res = await app.request('/public')
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('ok')
    })

    test('returns 401 when auth is required but no user', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry)
        app.get(
            '/private',
            requirePermission({ auth: true, permission: 'posts.list' }),
            (c) => c.text('ok'),
        )

        const res = await app.request('/private')
        expect(res.status).toBe(401)
        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('unauthorized')
    })

    test('returns 403 when user lacks the permission', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry, { roles: ['viewer'] })
        app.delete(
            '/posts/:id',
            requirePermission({ auth: true, permission: 'posts.delete' }),
            (c) => c.text('deleted'),
        )

        const res = await app.request('/posts/1', { method: 'DELETE' })
        expect(res.status).toBe(403)
        const body = (await res.json()) as {
            error: { code: string; permission: string }
        }
        expect(body.error.code).toBe('forbidden')
        expect(body.error.permission).toBe('posts.delete')
    })

    test('allows the request when permission resolves true', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry, { roles: ['editor'] })
        app.post(
            '/posts',
            requirePermission({ auth: true, permission: 'posts.create' }),
            (c) => c.text('created'),
        )

        const res = await app.request('/posts', { method: 'POST' })
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('created')
    })

    test('runs condition after the permission check', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry, { roles: ['editor'] })
        let conditionRan = false
        app.put(
            '/posts/:id',
            requirePermission({
                auth: true,
                permission: 'posts.update',
                condition: async (c) => {
                    conditionRan = true
                    return c.req.param('id') === 'own'
                },
            }),
            (c) => c.text('updated'),
        )

        const ok = await app.request('/posts/own', { method: 'PUT' })
        expect(ok.status).toBe(200)
        expect(conditionRan).toBe(true)

        const denied = await app.request('/posts/other', { method: 'PUT' })
        expect(denied.status).toBe(403)
    })

    test('strict-mode permission ignores user grants', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry, {
            roles: ['viewer'],
            permissionGrants: ['posts.delete'],
        })
        app.delete(
            '/posts/:id',
            requirePermission({ auth: true, permission: 'posts.delete' }),
            (c) => c.text('deleted'),
        )

        const res = await app.request('/posts/1', { method: 'DELETE' })
        expect(res.status).toBe(403)
    })

    test('explicit deny beats role grant', async () => {
        const registry = buildRegistry()
        const app = makeApp(registry, {
            roles: ['editor'],
            permissionDenies: ['posts.update'],
        })
        app.put(
            '/posts/:id',
            requirePermission({ auth: true, permission: 'posts.update' }),
            (c) => c.text('updated'),
        )

        const res = await app.request('/posts/1', { method: 'PUT' })
        expect(res.status).toBe(403)
    })
})
