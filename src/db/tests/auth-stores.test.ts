import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createSqliteDb, type SqliteDb } from '../index'
import { authSchema, createAuthTablesIfMissing } from '../schema/auth'
import { DrizzleSessionStore, DrizzleUserStore } from '../auth-stores'

let db: SqliteDb<typeof authSchema>

beforeEach(() => {
    db = createSqliteDb({ url: ':memory:', schema: authSchema })
    createAuthTablesIfMissing(db.raw)
})

afterEach(() => {
    db.close()
})

describe('DrizzleUserStore', () => {
    test('create + findById + findByEmail round-trip', async () => {
        const store = new DrizzleUserStore({ drizzle: db.drizzle })
        const created = await store.create({
            email: 'alice@example.com',
            passwordHash: 'hash',
            roles: ['customer'],
        })
        expect(created.id).toBeDefined()
        expect(created.email).toBe('alice@example.com')

        const byId = await store.findById(created.id)
        expect(byId?.email).toBe('alice@example.com')
        expect(byId?.roles).toEqual(['customer'])

        const byEmail = await store.findByEmail('Alice@Example.com')
        expect(byEmail?.id).toBe(created.id)
    })

    test('persists permissionGrants / permissionDenies', async () => {
        const store = new DrizzleUserStore({ drizzle: db.drizzle })
        const created = await store.create({
            email: 'bob@example.com',
            passwordHash: 'h',
            roles: ['editor'],
            permissionGrants: ['posts.publish'],
            permissionDenies: ['posts.delete'],
        })
        const fetched = await store.findById(created.id)
        expect(fetched?.permissionGrants).toEqual(['posts.publish'])
        expect(fetched?.permissionDenies).toEqual(['posts.delete'])
    })

    test('duplicate email throws a recognisable error', async () => {
        const store = new DrizzleUserStore({ drizzle: db.drizzle })
        await store.create({
            email: 'dup@x.com',
            passwordHash: 'h',
            roles: ['customer'],
        })
        await expect(
            store.create({
                email: 'dup@x.com',
                passwordHash: 'h',
                roles: ['customer'],
            }),
        ).rejects.toThrow(/already exists/)
    })

    test('returns null for unknown id / email', async () => {
        const store = new DrizzleUserStore({ drizzle: db.drizzle })
        expect(await store.findById('nope')).toBeNull()
        expect(await store.findByEmail('nobody@x.com')).toBeNull()
    })
})

describe('DrizzleSessionStore', () => {
    test('create + findById + delete', async () => {
        const userStore = new DrizzleUserStore({ drizzle: db.drizzle })
        const sessionStore = new DrizzleSessionStore({ drizzle: db.drizzle })
        const user = await userStore.create({
            email: 'sess@x.com',
            passwordHash: 'h',
            roles: ['customer'],
        })
        const session = await sessionStore.create(user.id, 60_000)
        expect(session.userId).toBe(user.id)
        const fetched = await sessionStore.findById(session.id)
        expect(fetched?.id).toBe(session.id)
        await sessionStore.delete(session.id)
        expect(await sessionStore.findById(session.id)).toBeNull()
    })

    test('expired sessions are deleted on read', async () => {
        const userStore = new DrizzleUserStore({ drizzle: db.drizzle })
        const sessionStore = new DrizzleSessionStore({ drizzle: db.drizzle })
        const user = await userStore.create({
            email: 'exp@x.com',
            passwordHash: 'h',
            roles: ['customer'],
        })
        const session = await sessionStore.create(user.id, -1)
        const found = await sessionStore.findById(session.id)
        expect(found).toBeNull()
    })

    test('deleteAllForUser removes every session for that user', async () => {
        const userStore = new DrizzleUserStore({ drizzle: db.drizzle })
        const sessionStore = new DrizzleSessionStore({ drizzle: db.drizzle })
        const user = await userStore.create({
            email: 'multi@x.com',
            passwordHash: 'h',
            roles: ['customer'],
        })
        const s1 = await sessionStore.create(user.id, 60_000)
        const s2 = await sessionStore.create(user.id, 60_000)
        await sessionStore.deleteAllForUser(user.id)
        expect(await sessionStore.findById(s1.id)).toBeNull()
        expect(await sessionStore.findById(s2.id)).toBeNull()
    })
})
