import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { z } from 'zod'
import { defineRoles } from '../../acl/roles'
import { defineAcl } from '../../acl/define'
import { aclContext, type AclUser } from '../../acl/middleware'
import { AclRegistry } from '../../acl/registry'
import { defineContract } from '../../module/contract'
import { defineModule } from '../../module/define'
import { bootstrap } from '../../bootstrap/index'
import { defineRoutes } from '../code'
import type { ModuleLogger } from '../../module/types'

function silentLogger(): ModuleLogger {
    const fn = () => {}
    const logger: ModuleLogger = {
        info: fn,
        warn: fn,
        error: fn,
        debug: fn,
        child: () => logger,
    }
    return logger
}

const usersContract = defineContract('users', {
    findById: { input: z.object({ id: z.string() }), output: z.string() },
})

const PostBody = z.object({ title: z.string().min(1) })

const roles = defineRoles({
    admin: { description: 'Admin' },
    viewer: { description: 'Viewer' },
})

const postsAcl = defineAcl({
    module: 'posts',
    permissions: ['posts.list', 'posts.create'] as const,
    defaults: {
        admin: ['*'],
        viewer: ['posts.list'],
    },
})

describe('defineRoutes + r builder', () => {
    test('public route works without auth', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get('/', {}, (c) => c.json({ ok: true }))
        })

        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const { app } = await bootstrap({
            roles,
            modules: [posts],
            logger: silentLogger(),
        })
        const res = await app.request('/api/posts')
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    test('permission-gated route returns 401 when anonymous', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get(
                '/',
                { auth: true, permission: 'posts.list' },
                (c) => c.json({ items: [] }),
            )
        })

        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const { app } = await bootstrap({
            roles,
            modules: [posts],
            logger: silentLogger(),
        })

        const anon = await app.request('/api/posts')
        expect(anon.status).toBe(401)
    })

    test('body validation returns 422 on bad input', async () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.post('/', { body: PostBody }, async (c) => {
                const data = c.req.valid('json' as never) as { title: string }
                return c.json({ received: data })
            })
        })

        const posts = defineModule({
            name: 'posts',
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const { app } = await bootstrap({
            roles,
            modules: [posts],
            logger: silentLogger(),
        })

        const bad = await app.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: '' }),
        })
        expect(bad.status).toBe(422)
        const body = (await bad.json()) as {
            error: { code: string; details: Array<{ path: string[] }> }
        }
        expect(body.error.code).toBe('validation_failed')
        expect(body.error.details[0]!.path).toEqual(['title'])

        const ok = await app.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Hi' }),
        })
        expect(ok.status).toBe(200)
        expect(await ok.json()).toEqual({ received: { title: 'Hi' } })
    })

    test('authorized request with role grant succeeds (manual wiring)', async () => {
        // bootstrap installs aclContext before any user-setter, so we wire by
        // hand to prove the route + permission + valid-user path works.
        const apiRoutes = defineRoutes(({ r }) => {
            r.get(
                '/',
                { auth: true, permission: 'posts.list' },
                (c) => c.json({ items: ['a', 'b'] }),
            )
        })

        const sub = await apiRoutes.build({} as never)
        const registry = new AclRegistry(roles, [postsAcl])
        const user: AclUser = { roles: ['viewer'] }

        const app = new Hono()
        app.use('*', async (c, next) => {
            c.set('user', user)
            await next()
        })
        app.use('*', aclContext({ registry }))
        app.route('/api/posts', sub)

        const res = await app.request('/api/posts')
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ items: ['a', 'b'] })
    })

    test('routes can reach into typed services from imports', async () => {
        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => ({ findById: async ({ id }) => `user:${id}` }),
        })

        const apiRoutes = defineRoutes<readonly [typeof usersContract]>(
            ({ r, services }) => {
                r.get('/:id', { param: z.object({ id: z.string() }) }, async (c) => {
                    const { id } = c.req.valid('param' as never) as { id: string }
                    const found = await services.users.findById({ id })
                    return c.json({ found })
                })
            },
        )

        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            acl: postsAcl,
            routes: { handler: apiRoutes, prefix: '/api/posts' },
        })

        const { app } = await bootstrap({
            roles,
            modules: [users, posts],
            logger: silentLogger(),
        })
        const res = await app.request('/api/posts/42')
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ found: 'user:42' })
    })

    test('declared routes are introspectable', () => {
        const apiRoutes = defineRoutes(({ r }) => {
            r.get('/', { auth: true, permission: 'posts.list' }, (c) => c.text('ok'))
            r.post('/', { permission: 'posts.create' }, (c) => c.text('ok'))
        })
        // Build with no services to populate `declared`.
        void apiRoutes.build({} as never)
        // Builder runs synchronously up to async-only bits; declared is filled.
        expect(apiRoutes.declared.length).toBeGreaterThanOrEqual(2)
        expect(apiRoutes.declared.map((d) => `${d.method.toUpperCase()} ${d.path}`))
            .toEqual(expect.arrayContaining(['GET /', 'POST /']))
    })
})
