/**
 * Compile-only assertions for the `c.req.valid(target)` typing on routes.
 * If any `expectType` line stops type-checking, the routing types have
 * regressed and the build will fail. Nothing here runs at runtime — `bun test`
 * still collects this file so the suite count reflects coverage of the area.
 */
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineRoutes } from '../code'

// Tiny structural type-equality helper. `Equal<A, B>` is true when A and B are
// mutually assignable. We don't pull in a heavyweight `expect-type` package
// for one assertion.
type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false
function expectType<T extends true>(_: T): void {}

describe('routing typing (compile-time)', () => {
    test('c.req.valid("json") is inferred from body schema', () => {
        const Body = z.object({ title: z.string(), age: z.number() })

        defineRoutes(({ r }) => {
            r.post('/', { body: Body }, (c) => {
                const data = c.req.valid('json')
                expectType<Equal<typeof data, { title: string; age: number }>>(true)
                return c.json(data)
            })
        })

        expect(true).toBe(true)
    })

    test('c.req.valid("param") is inferred from param schema', () => {
        const Params = z.object({ id: z.string() })

        defineRoutes(({ r }) => {
            r.get('/:id', { param: Params }, (c) => {
                const data = c.req.valid('param')
                expectType<Equal<typeof data, { id: string }>>(true)
                return c.json(data)
            })
        })

        expect(true).toBe(true)
    })

    test('targets without declared schemas are NOT in the valid() union', () => {
        defineRoutes(({ r }) => {
            r.get('/', { query: z.object({ q: z.string() }) }, (c) => {
                const q = c.req.valid('query')
                expectType<Equal<typeof q, { q: string }>>(true)
                // @ts-expect-error — no `body` schema, so 'json' is not callable
                c.req.valid('json')
                return c.json(q)
            })
        })

        expect(true).toBe(true)
    })
})
