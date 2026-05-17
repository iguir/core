import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineEvents } from '../define'

describe('defineEvents', () => {
    test('namespaces event names with the module', () => {
        const e = defineEvents('posts', {
            created: z.object({ id: z.string() }),
            updated: z.object({ id: z.string() }),
        })
        expect(Object.keys(e.events)).toEqual(['posts.created', 'posts.updated'])
        expect(e.events['posts.created'].name).toBe('posts.created')
    })

    test('rejects invalid module names', () => {
        expect(() => defineEvents('Posts', { created: z.any() })).toThrow(/invalid/)
    })

    test('requires at least one event', () => {
        expect(() => defineEvents('posts', {})).toThrow(/at least one event/)
    })

    test('rejects non-Zod schemas', () => {
        expect(() =>
            // @ts-expect-error
            defineEvents('posts', { created: { foo: 1 } }),
        ).toThrow(/Zod schema/)
    })
})
