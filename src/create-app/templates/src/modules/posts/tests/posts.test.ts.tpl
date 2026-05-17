import { describe, expect, test } from 'bun:test'
import { testApp } from '@iguir/core'
import { roles } from '../../../app/acl'
import { auth } from '../../../app/auth'
import { postsModule } from '../posts.module'

describe('posts module', () => {
    test('GET /api/posts/health is public', async () => {
        const app = await testApp({ roles, modules: [auth, postsModule] })
        const { status, body } = await app.json<{ ok: boolean }>(
            '/api/posts/health',
        )
        expect(status).toBe(200)
        expect(body.ok).toBe(true)
        await app.shutdown()
    })

    test('create + list as editor', async () => {
        const app = await testApp({
            roles,
            modules: [auth, postsModule],
            user: { id: 'u1', roles: ['editor'] },
        })

        const create = await app.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Hello', body: 'World' }),
        })
        expect(create.status).toBe(201)

        const { status, body } = await app.json<Array<{ title: string }>>(
            '/api/posts',
        )
        expect(status).toBe(200)
        expect(body[0]?.title).toBe('Hello')

        await app.shutdown()
    })

    test('viewer cannot create posts', async () => {
        const app = await testApp({
            roles,
            modules: [auth, postsModule],
            user: { id: 'u2', roles: ['viewer'] },
        })
        const res = await app.request('/api/posts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Nope' }),
        })
        expect(res.status).toBe(403)
        await app.shutdown()
    })
})
