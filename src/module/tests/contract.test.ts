import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineContract } from '../contract'

describe('defineContract', () => {
    test('returns a frozen contract with name + methods', () => {
        const c = defineContract('users', {
            findById: { input: z.object({ id: z.string() }), output: z.string() },
        })
        expect(c.name).toBe('users')
        expect(Object.isFrozen(c)).toBe(true)
        expect(typeof c.methods.findById.input.parse).toBe('function')
    })

    test('rejects invalid contract names', () => {
        expect(() => defineContract('Users', { x: { input: z.any(), output: z.any() } }))
            .toThrow(/invalid/)
        expect(() => defineContract('1users', { x: { input: z.any(), output: z.any() } }))
            .toThrow(/invalid/)
    })

    test('rejects empty method maps', () => {
        expect(() => defineContract('users', {})).toThrow(/at least one method/)
    })

    test('rejects non-Zod schemas', () => {
        expect(() =>
            // @ts-expect-error — testing runtime validation
            defineContract('users', { findById: { input: { foo: 1 }, output: z.any() } }),
        ).toThrow(/Zod schema/)
    })

    test('rejects malformed method names', () => {
        expect(() =>
            defineContract('users', {
                'bad-name': { input: z.any(), output: z.any() },
            }),
        ).toThrow(/invalid/)
    })
})
