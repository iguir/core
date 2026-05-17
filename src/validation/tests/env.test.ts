import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineEnv } from '../env'

describe('defineEnv', () => {
    test('returns the parsed env object', () => {
        const env = defineEnv(
            z.object({
                DATABASE_URL: z.string(),
                PORT: z.coerce.number().default(3000),
            }),
            { source: { DATABASE_URL: 'postgres://x' } },
        )
        expect(env.DATABASE_URL).toBe('postgres://x')
        expect(env.PORT).toBe(3000)
    })

    test('throws a formatted multi-line error on failure', () => {
        try {
            defineEnv(
                z.object({
                    DATABASE_URL: z.url(),
                    PORT: z.coerce.number().int().min(1),
                }),
                { source: { DATABASE_URL: 'not-a-url', PORT: '0' } },
            )
            throw new Error('should have thrown')
        } catch (err) {
            expect(err).toBeInstanceOf(Error)
            const msg = (err as Error).message
            expect(msg).toContain('[env]')
            expect(msg).toContain('DATABASE_URL')
            expect(msg).toContain('PORT')
        }
    })
})
