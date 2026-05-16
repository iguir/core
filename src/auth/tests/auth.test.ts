import { describe, expect, test } from 'bun:test'
import { defineRoles } from '../../acl/roles'
import { testApp } from '../../testing/index'
import {
    MemorySessionStore,
    MemoryUserStore,
    authContract,
    authEvents,
    createAuthModule,
} from '../index'

const roles = defineRoles({
    admin: { description: 'Admin' },
    customer: { description: 'Customer' },
})

function makeApp() {
    const userStore = new MemoryUserStore()
    const sessionStore = new MemorySessionStore()
    const auth = createAuthModule({
        userStore,
        sessionStore,
        cookieSecure: false,
    })
    return { userStore, sessionStore, auth }
}

describe('@app/auth — registration', () => {
    test('register creates a user, sets session cookie, emits event', async () => {
        const { auth } = makeApp()
        const app = await testApp({ roles, modules: [auth] })

        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'alice@example.com',
                password: 'correct horse battery staple',
            }),
        })

        expect(res.status).toBe(201)
        const body = (await res.json()) as { id: string; email: string }
        expect(body.email).toBe('alice@example.com')

        const cookie = res.headers.get('set-cookie')
        expect(cookie).toMatch(/app_session=/)
        expect(cookie).toMatch(/HttpOnly/i)

        const events = app.events()
        expect(events.some((e) => e.name === 'auth.user.registered')).toBe(true)

        await app.shutdown()
    })

    test('rejects duplicate email with 409', async () => {
        const { auth } = makeApp()
        const app = await testApp({ roles, modules: [auth] })
        const payload = {
            email: 'bob@example.com',
            password: 'longenoughpw',
        }
        const a = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        })
        expect(a.status).toBe(201)
        const b = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        })
        expect(b.status).toBe(409)
        await app.shutdown()
    })

    test('rejects short passwords with 422', async () => {
        const { auth } = makeApp()
        const app = await testApp({ roles, modules: [auth] })
        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'x@y.z', password: 'short' }),
        })
        expect(res.status).toBe(422)
        await app.shutdown()
    })
})

describe('@app/auth — login + session lifecycle', () => {
    test('login → me → logout round-trip', async () => {
        const { auth, userStore } = makeApp()
        const app = await testApp({ roles, modules: [auth] })

        // Seed a user directly via the store.
        await userStore.create({
            email: 'carol@example.com',
            passwordHash: await Bun.password.hash('mysecretpw'),
            roles: ['customer'],
        })

        const login = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'carol@example.com',
                password: 'mysecretpw',
            }),
        })
        expect(login.status).toBe(200)
        const cookie = login.headers.get('set-cookie')!
        const sessionCookie = cookie.split(';')[0]!  // "app_session=<uuid>"

        // Without cookie, /me returns 401.
        const anon = await app.request('/auth/me', { user: null })
        expect(anon.status).toBe(401)

        // With cookie, /me returns the public user.
        const me = await app.request('/auth/me', {
            user: null,
            headers: { cookie: sessionCookie },
        })
        expect(me.status).toBe(200)
        const meBody = (await me.json()) as { email: string }
        expect(meBody.email).toBe('carol@example.com')

        // Logout invalidates the session.
        const logout = await app.request('/auth/logout', {
            method: 'POST',
            user: null,
            headers: { cookie: sessionCookie },
        })
        expect(logout.status).toBe(204)

        // After logout, the cookie still exists client-side but the server
        // rejects it — /me is 401.
        const after = await app.request('/auth/me', {
            user: null,
            headers: { cookie: sessionCookie },
        })
        expect(after.status).toBe(401)

        await app.shutdown()
    })

    test('login with bad password returns 401', async () => {
        const { auth, userStore } = makeApp()
        const app = await testApp({ roles, modules: [auth] })
        await userStore.create({
            email: 'dave@example.com',
            passwordHash: await Bun.password.hash('correctpw'),
            roles: ['customer'],
        })
        const res = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'dave@example.com',
                password: 'wrongpw',
            }),
        })
        expect(res.status).toBe(401)
        await app.shutdown()
    })
})

describe('@app/auth — contract', () => {
    test('other modules can call the auth contract via services', async () => {
        const { auth } = makeApp()
        const app = await testApp({ roles, modules: [auth] })

        const svc = app.service(authContract)
        const created = await svc.registerUser({
            email: 'eve@example.com',
            password: 'longenoughpw',
            roles: ['customer'],
        })
        expect(created.email).toBe('eve@example.com')

        const found = await svc.findUserByEmail({ email: 'eve@example.com' })
        expect(found?.id).toBe(created.id)

        const verified = await svc.verifyPassword({
            email: 'eve@example.com',
            password: 'longenoughpw',
        })
        expect(verified?.id).toBe(created.id)

        const bad = await svc.verifyPassword({
            email: 'eve@example.com',
            password: 'wrong',
        })
        expect(bad).toBeNull()

        await app.shutdown()
    })
})

describe('@app/auth — event integration', () => {
    test('a subscriber module sees auth events end-to-end', async () => {
        const { auth } = makeApp()
        const received: unknown[] = []
        const subscriber = {
            name: 'welcome' as const,
            subscriptions: {
                'auth.user.registered': (payload: unknown) => {
                    received.push(payload)
                },
            },
        }
        const app = await testApp({
            roles,
            modules: [auth, subscriber],
        })

        await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'frank@example.com',
                password: 'longenoughpw',
            }),
        })

        // Wait a tick — publish is async.
        await new Promise((r) => setTimeout(r, 5))
        expect(received.length).toBe(1)
        expect((received[0] as { email: string }).email).toBe('frank@example.com')

        await app.shutdown()
    })
})

describe('@app/auth — registered events are namespaced correctly', () => {
    test('event names use "auth.user.<kind>" form', () => {
        expect(Object.keys(authEvents.events)).toEqual([
            'auth.user.registered',
            'auth.user.logged_in',
            'auth.user.logged_out',
        ])
    })
})
