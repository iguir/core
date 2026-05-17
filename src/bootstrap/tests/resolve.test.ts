import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineContract } from '../../module/contract'
import { defineModule } from '../../module/define'
import { ModuleRegistry } from '../../module/registry'
import { resolveServices } from '../resolve'
import type { ModuleLogger } from '../../module/types'

const noopLogger: ModuleLogger = {
    info() {},
    warn() {},
    error() {},
    debug() {},
    child: () => noopLogger,
}

const usersContract = defineContract('users', {
    findById: { input: z.object({ id: z.string() }), output: z.string() },
})

const postsContract = defineContract('posts', {
    listByAuthor: {
        input: z.object({ authorId: z.string() }),
        output: z.array(z.string()),
    },
})

describe('resolveServices', () => {
    test('runs factories in topo order; imports see resolved services', async () => {
        const order: string[] = []

        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => {
                order.push('users')
                return { findById: async ({ id }) => `user:${id}` }
            },
        })

        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            provides: postsContract,
            implementation: ({ services }) => {
                order.push('posts')
                return {
                    listByAuthor: async ({ authorId }) => {
                        const u = await services.users.findById({ id: authorId })
                        return [`post-by-${u}`]
                    },
                }
            },
        })

        const reg = new ModuleRegistry([posts, users])
        const sr = await resolveServices(reg, { logger: noopLogger })

        expect(order).toEqual(['users', 'posts'])

        const postsImpl = sr.require(postsContract)
        expect(await postsImpl.listByAuthor({ authorId: '42' })).toEqual([
            'post-by-user:42',
        ])
    })

    test('throws when a factory throws, tagged with the module name', async () => {
        const broken = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => {
                throw new Error('boom')
            },
        })
        const reg = new ModuleRegistry([broken])
        expect(resolveServices(reg, { logger: noopLogger })).rejects.toThrow(
            /\[module:users\].*boom/,
        )
    })

    test('rejects implementations missing a contract method', async () => {
        const incomplete = defineModule({
            name: 'users',
            provides: usersContract,
            // @ts-expect-error — intentionally incomplete
            implementation: () => ({}),
        })
        const reg = new ModuleRegistry([incomplete])
        expect(resolveServices(reg, { logger: noopLogger })).rejects.toThrow(
            /missing method "findById"/,
        )
    })

    test('require() throws for unknown contracts', async () => {
        const reg = new ModuleRegistry([])
        const sr = await resolveServices(reg, { logger: noopLogger })
        expect(() => sr.require(usersContract)).toThrow(/no implementation/)
        expect(sr.get(usersContract)).toBeUndefined()
    })
})
