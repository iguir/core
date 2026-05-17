import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineAcl } from '../../acl/define'
import { defineRoles } from '../../acl/roles'
import { defineContract } from '../../module/contract'
import { defineModule } from '../../module/define'
import { defineEvents } from '../../events/define'
import { defineRoutes } from '../../routing/code'
import { testApp } from '../index'

const roles = defineRoles({
    admin: { description: 'Admin' },
    editor: { description: 'Editor' },
    viewer: { description: 'Viewer' },
})

const usersContract = defineContract('users', {
    findById: { input: z.object({ id: z.string() }), output: z.string() },
})

const postsAcl = defineAcl({
    module: 'posts',
    permissions: ['posts.list', 'posts.create'] as const,
    defaults: {
        admin: ['*'],
        editor: ['posts.list', 'posts.create'],
        viewer: ['posts.list'],
    },
})

const postsEvents = defineEvents('posts', {
    created: z.object({ id: z.string(), authorId: z.string() }),
})

const PostBody = z.object({ title: z.string().min(1) })

describe('testApp', () => {
    test('public route works with anonymous user', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get('/health', {}, (c) => c.json({ ok: true }))
        })
        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const app = await testApp({ roles, modules: [posts] })
        const { status, body } = await app.json<{ ok: boolean }>('/api/posts/health')
        expect(status).toBe(200)
        expect(body).toEqual({ ok: true })
        await app.shutdown()
    })

    test('baseline user gets permission-gated routes', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get('/', { auth: true, permission: 'posts.list' }, (c) =>
                c.json({ items: [] }),
            )
        })
        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const app = await testApp({
            roles,
            modules: [posts],
            user: { roles: ['viewer'] },
        })
        const ok = await app.request('/api/posts')
        expect(ok.status).toBe(200)
        await app.shutdown()
    })

    test('.as(user) overrides per-request without re-bootstrapping', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.post(
                '/',
                { auth: true, permission: 'posts.create', body: PostBody },
                async (c) => c.json({ created: true }, 201),
            )
        })
        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const app = await testApp({
            roles,
            modules: [posts],
            user: { roles: ['viewer'] }, // baseline: viewer can NOT create
        })

        const denied = await app.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Hi' }),
        })
        expect(denied.status).toBe(403)

        const allowed = await app
            .as({ roles: ['editor'] })
            .request('/api/posts', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title: 'Hi' }),
            })
        expect(allowed.status).toBe(201)
        await app.shutdown()
    })

    test('per-request user override wins over baseline + .as()', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get('/', { auth: true, permission: 'posts.list' }, (c) =>
                c.json({ ok: true }),
            )
        })
        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })
        const app = await testApp({
            roles,
            modules: [posts],
            user: { roles: ['viewer'] },
        })

        const anon = await app.request('/api/posts', { user: null })
        expect(anon.status).toBe(401)
        await app.shutdown()
    })

    test('captures bus events for assertion', async () => {
        const usersModule = defineModule({
            name: 'users',
            events: postsEvents,
        })
        const app = await testApp({ roles, modules: [usersModule] })

        await app.bus.publish(postsEvents.events['posts.created'], {
            id: '1',
            authorId: 'a',
        })
        await app.bus.publish(postsEvents.events['posts.created'], {
            id: '2',
            authorId: 'b',
        })

        const events = app.events()
        expect(events.length).toBe(2)
        expect(events.map((e) => e.name)).toEqual([
            'posts.created',
            'posts.created',
        ])
        expect((events[0]!.payload as { id: string }).id).toBe('1')

        app.clearEvents()
        expect(app.events()).toEqual([])
        await app.shutdown()
    })

    test('app.service(contract) returns typed implementation for unit-level calls', async () => {
        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => ({ findById: async ({ id }) => `user:${id}` }),
        })
        const app = await testApp({ roles, modules: [users] })
        const svc = app.service(usersContract)
        expect(await svc.findById({ id: '42' })).toBe('user:42')
        await app.shutdown()
    })

    test('validation error renders as 422 JSON', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.post('/', { body: PostBody }, (c) => c.json({}))
        })
        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })
        const app = await testApp({ roles, modules: [posts] })
        const { status, body } = await app.json<{
            error: { code: string }
        }>('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: '' }),
        })
        expect(status).toBe(422)
        expect(body.error.code).toBe('validation_failed')
        await app.shutdown()
    })
})
