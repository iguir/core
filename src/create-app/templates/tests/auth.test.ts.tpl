import { describe, expect, test } from 'bun:test'
import { testApp } from '@iguir/core/testing'
import { roles } from '../src/app/acl'
import { auth } from '../src/app/auth'

describe('auth flow', () => {
    test('register → me round-trip', async () => {
        const app = await testApp({ roles, modules: [auth] })

        const register = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'longenoughpw',
            }),
        })
        expect(register.status).toBe(201)
        const cookie = register.headers.get('set-cookie')!.split(';')[0]!

        const me = await app.request('/auth/me', {
            user: null,
            headers: { cookie },
        })
        expect(me.status).toBe(200)
        expect(((await me.json()) as { email: string }).email).toBe(
            'test@example.com',
        )

        await app.shutdown()
    })
})
