import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineContract } from '../contract'
import { defineModule } from '../define'
import { ModuleRegistry } from '../registry'

const usersContract = defineContract('users', {
    findById: { input: z.object({ id: z.string() }), output: z.any() },
})
const postsContract = defineContract('posts', {
    list: { input: z.void(), output: z.array(z.any()) },
})
const commentsContract = defineContract('comments', {
    list: { input: z.void(), output: z.array(z.any()) },
})

const usersImpl = () => ({ findById: async () => ({}) })
const postsImpl = () => ({ list: async () => [] })
const commentsImpl = () => ({ list: async () => [] })

describe('ModuleRegistry', () => {
    test('indexes modules by name + lists in boot order', () => {
        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: usersImpl,
        })
        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            provides: postsContract,
            implementation: postsImpl,
        })
        const reg = new ModuleRegistry([posts, users])
        expect(reg.has('users')).toBe(true)
        expect(reg.has('posts')).toBe(true)
        const order = reg.inBootOrder().map((m) => m.name)
        expect(order).toEqual(['users', 'posts'])
    })

    test('rejects duplicate module names', () => {
        const a = defineModule({ name: 'posts' })
        const b = defineModule({ name: 'posts' })
        expect(() => new ModuleRegistry([a, b])).toThrow(/registered more than once/)
    })

    test('rejects duplicate contract providers (defense-in-depth)', () => {
        // defineModule enforces provides.name === module.name, so two real
        // modules cannot both provide the same contract via the public API.
        // The registry still defends against raw specs that bypass defineModule.
        const a = { name: 'users', provides: usersContract } as const
        const b = { name: 'users_v2', provides: usersContract } as const
        expect(() => new ModuleRegistry([a, b])).toThrow(/provided by both/)
    })

    test('rejects unsatisfied imports', () => {
        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            provides: postsContract,
            implementation: postsImpl,
        })
        expect(() => new ModuleRegistry([posts])).toThrow(
            /no module provides it/,
        )
    })

    test('detects import cycles', () => {
        const posts = defineModule({
            name: 'posts',
            imports: [commentsContract],
            provides: postsContract,
            implementation: postsImpl,
        })
        const comments = defineModule({
            name: 'comments',
            imports: [postsContract],
            provides: commentsContract,
            implementation: commentsImpl,
        })
        expect(() => new ModuleRegistry([posts, comments])).toThrow(/cycle detected/)
    })

    test('providerOf resolves contracts to their owning module', () => {
        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: usersImpl,
        })
        const reg = new ModuleRegistry([users])
        expect(reg.providerOf('users')?.name).toBe('users')
        expect(reg.providerOf('unknown')).toBeUndefined()
    })

    test('boot order is stable + deterministic', () => {
        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: usersImpl,
        })
        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            provides: postsContract,
            implementation: postsImpl,
        })
        const comments = defineModule({
            name: 'comments',
            imports: [postsContract, usersContract],
            provides: commentsContract,
            implementation: commentsImpl,
        })
        const reg = new ModuleRegistry([comments, posts, users])
        expect(reg.inBootOrder().map((m) => m.name)).toEqual([
            'users',
            'posts',
            'comments',
        ])
    })
})
