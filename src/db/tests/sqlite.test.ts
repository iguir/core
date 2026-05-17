import { describe, expect, test } from 'bun:test'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { eq } from 'drizzle-orm'
import { createDb, createSqliteDb } from '../index'

const items = sqliteTable('items', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
})

describe('createSqliteDb / createDb', () => {
    test('opens an in-memory db and runs a basic CRUD round-trip', async () => {
        const db = createSqliteDb({ url: ':memory:', schema: { items } })
        db.raw.exec('CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL);')

        await db.drizzle.insert(items).values({ id: '1', name: 'first' })
        const rows = await db.drizzle.select().from(items).where(eq(items.id, '1'))

        expect(rows).toEqual([{ id: '1', name: 'first' }])
        db.close()
    })

    test('createDb dispatches sqlite driver correctly', async () => {
        const db = createDb({
            driver: 'sqlite',
            url: ':memory:',
            schema: { items },
        })
        expect(db.driver).toBe('sqlite')
        if (db.driver !== 'sqlite') throw new Error('narrowing failed')
        db.raw.exec('CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL);')
        await db.drizzle.insert(items).values({ id: '1', name: 'one' })
        const out = await db.drizzle.select().from(items)
        expect(out.length).toBe(1)
        db.close()
    })

    test('close() is idempotent', () => {
        const db = createSqliteDb({ url: ':memory:' })
        db.close()
        db.close() // should not throw
    })
})
