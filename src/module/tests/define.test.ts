import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineContract } from '../contract'
import { defineModule } from '../define'
import { defineAcl } from '../../acl/define'

const usersContract = defineContract('users', {
    findById: { input: z.object({ id: z.string() }), output: z.string() },
})

const postsContract = defineContract('posts', {
    list: { input: z.void(), output: z.array(z.string()) },
})

describe('defineModule', () => {
    test('minimal module with just a name is valid + frozen', () => {
        const m = defineModule({ name: 'posts' })
        expect(m.name).toBe('posts')
        expect(Object.isFrozen(m)).toBe(true)
    })

    test('rejects invalid module names', () => {
        expect(() => defineModule({ name: 'Posts' })).toThrow(/invalid/)
        expect(() => defineModule({ name: '1posts' })).toThrow(/invalid/)
    })

    test('imports must be contracts and unique', () => {
        expect(() =>
            // @ts-expect-error
            defineModule({ name: 'posts', imports: [{ foo: 'bar' }] }),
        ).toThrow(/defineContract/)

        expect(() =>
            defineModule({
                name: 'posts',
                imports: [usersContract, usersContract],
            }),
        ).toThrow(/duplicate import/)
    })

    test('module cannot import its own contract', () => {
        expect(() =>
            defineModule({
                name: 'posts',
                imports: [postsContract],
            }),
        ).toThrow(/cannot import its own contract/)
    })

    test('provides must match module name', () => {
        expect(() =>
            defineModule({
                name: 'posts',
                provides: usersContract,
            }),
        ).toThrow(/must match module name/)
    })

    test('acl.module must match module name', () => {
        const wrongAcl = defineAcl({
            module: 'comments',
            permissions: ['comments.read'] as const,
            defaults: {},
        })
        expect(() =>
            defineModule({ name: 'posts', acl: wrongAcl }),
        ).toThrow(/acl\.module is "comments"/)
    })

    test('accepts a matching ACL', () => {
        const acl = defineAcl({
            module: 'posts',
            permissions: ['posts.read'] as const,
            defaults: {},
        })
        const m = defineModule({ name: 'posts', acl })
        expect(m.acl).toBe(acl)
    })

    test('routes.prefix must start with /', () => {
        expect(() =>
            defineModule({
                name: 'posts',
                routes: { handler: { __kind: 'app:routes' }, prefix: 'api' },
            }),
        ).toThrow(/must start with "\/"/)
    })

    test('subscription event names must be dotted', () => {
        expect(() =>
            defineModule({
                name: 'posts',
                subscriptions: { invalidname: () => {} },
            }),
        ).toThrow(/invalid format/)
    })

    test('subscription handlers must be functions', () => {
        expect(() =>
            defineModule({
                name: 'posts',
                // @ts-expect-error
                subscriptions: { 'user.created': 'not a fn' },
            }),
        ).toThrow(/must be a function/)
    })

    test('lifecycle hooks must be functions when provided', () => {
        expect(() =>
            // @ts-expect-error
            defineModule({ name: 'posts', onBoot: 'nope' }),
        ).toThrow(/onBoot must be a function/)
    })
})
