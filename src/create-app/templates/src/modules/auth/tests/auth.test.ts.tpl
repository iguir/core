import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { testApp, type TestApp } from '@iguir/core'
import { roles } from '../../../app/acl'
import { authModule } from '../auth.module'

/**
 * These tests boot the real auth module — which talks to Postgres. They run
 * by default; set `IGUIR_SKIP_DB_TESTS=1` to skip when you don't have a
 * local Postgres up (`docker compose up -d` + `bun run db:push`).
 */

const skip = process.env.IGUIR_SKIP_DB_TESTS === '1'

let app: TestApp

beforeAll(async () => {
    if (skip) return
    app = await testApp({ roles, modules: [authModule] })
})

afterAll(async () => {
    await app?.shutdown?.()
})

describe('auth module', () => {
    test.skipIf(skip)('register → me → logout', async () => {
        const email = `t${Date.now()}@example.com`

        const register = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password: 'longenoughpw' }),
        })
        expect(register.status).toBe(201)
        const cookie = register.headers.get('set-cookie')!.split(';')[0]!

        const me = await app.request('/auth/me', { user: null, headers: { cookie } })
        expect(me.status).toBe(200)
        expect(((await me.json()) as { email: string }).email).toBe(email)

        const logout = await app.request('/auth/logout', {
            method: 'POST',
            user: null,
            headers: { cookie },
        })
        expect(logout.status).toBe(204)

        const after = await app.request('/auth/me', { user: null, headers: { cookie } })
        expect(after.status).toBe(401)
    })

    test.skipIf(skip)('login with bad password returns 401', async () => {
        const res = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'nope@example.com', password: 'wrong' }),
        })
        expect(res.status).toBe(401)
    })

    test.skipIf(skip)('duplicate registration returns 409', async () => {
        const email = `dup${Date.now()}@example.com`
        const body = JSON.stringify({ email, password: 'longenoughpw' })
        const a = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
        })
        expect(a.status).toBe(201)

        const b = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
        })
        expect(b.status).toBe(409)
    })
})
