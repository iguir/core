import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { defineRoles } from '../../acl/roles'
import { createAuthModule } from '../../auth/index'
import { testApp } from '../../testing/index'
import { createSqliteDb, type SqliteDb } from '../index'
import { authSchema, createAuthTablesIfMissing } from '../schema/auth'
import { DrizzleSessionStore, DrizzleUserStore } from '../auth-stores'

const roles = defineRoles({
    admin: { description: 'Admin' },
    customer: { description: 'Customer' },
})

let db: SqliteDb<typeof authSchema>

beforeEach(() => {
    db = createSqliteDb({ url: ':memory:', schema: authSchema })
    createAuthTablesIfMissing(db.raw)
})

afterEach(() => {
    db.close()
})

describe('auth module + DrizzleUserStore end-to-end', () => {
    test('register → login → me round-trip persists through Drizzle', async () => {
        const auth = createAuthModule({
            userStore: new DrizzleUserStore({ drizzle: db.drizzle }),
            sessionStore: new DrizzleSessionStore({ drizzle: db.drizzle }),
            cookieSecure: false,
        })

        const app = await testApp({ roles, modules: [auth] })

        const register = await app.request('/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'drizzle@example.com',
                password: 'longenoughpw',
            }),
        })
        expect(register.status).toBe(201)

        // Independent verification: the row landed in the actual database.
        const directLookup = await db.drizzle
            .select()
            .from(authSchema.users)
        expect(directLookup.length).toBe(1)
        expect(directLookup[0]?.email).toBe('drizzle@example.com')

        const login = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'drizzle@example.com',
                password: 'longenoughpw',
            }),
        })
        expect(login.status).toBe(200)
        const cookie = login.headers.get('set-cookie')!.split(';')[0]!

        const me = await app.request('/auth/me', {
            user: null,
            headers: { cookie },
        })
        expect(me.status).toBe(200)
        expect(((await me.json()) as { email: string }).email).toBe(
            'drizzle@example.com',
        )

        await app.shutdown()
    })
})
