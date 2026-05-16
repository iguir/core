import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineContract } from '../../module/contract'
import { defineModule } from '../../module/define'
import { ModuleRegistry } from '../../module/registry'
import { resolveServices } from '../resolve'
import { Lifecycle } from '../lifecycle'
import type { ModuleLogger } from '../../module/types'

function makeLogger(): ModuleLogger {
    const fn = () => {}
    const logger: ModuleLogger = {
        info: fn,
        warn: fn,
        error: fn,
        debug: fn,
        child: () => logger,
    }
    return logger
}

const usersContract = defineContract('users', {
    findById: { input: z.object({ id: z.string() }), output: z.string() },
})

const postsContract = defineContract('posts', {
    list: { input: z.void(), output: z.array(z.string()) },
})

describe('Lifecycle', () => {
    test('runs onBoot in topo order; onShutdown in reverse', async () => {
        const events: string[] = []

        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => ({ findById: async ({ id }) => id }),
            onBoot: () => {
                events.push('boot:users')
            },
            onShutdown: () => {
                events.push('shutdown:users')
            },
        })

        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            provides: postsContract,
            implementation: () => ({ list: async () => [] }),
            onBoot: () => {
                events.push('boot:posts')
            },
            onShutdown: () => {
                events.push('shutdown:posts')
            },
        })

        const registry = new ModuleRegistry([posts, users])
        const logger = makeLogger()
        const services = await resolveServices(registry, { logger })
        const lifecycle = new Lifecycle({ registry, services, logger })

        await lifecycle.boot()
        expect(events).toEqual(['boot:users', 'boot:posts'])

        const report = await lifecycle.shutdown()
        expect(events).toEqual([
            'boot:users',
            'boot:posts',
            'shutdown:posts',
            'shutdown:users',
        ])
        expect(report.completed).toEqual(['posts', 'users'])
        expect(report.failed).toEqual([])
    })

    test('rolls back booted modules when a later onBoot throws', async () => {
        const events: string[] = []

        const users = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => ({ findById: async ({ id }) => id }),
            onBoot: () => {
                events.push('boot:users')
            },
            onShutdown: () => {
                events.push('shutdown:users')
            },
        })

        const posts = defineModule({
            name: 'posts',
            imports: [usersContract],
            provides: postsContract,
            implementation: () => ({ list: async () => [] }),
            onBoot: () => {
                events.push('boot:posts')
                throw new Error('boom')
            },
            onShutdown: () => {
                events.push('shutdown:posts')
            },
        })

        const registry = new ModuleRegistry([users, posts])
        const logger = makeLogger()
        const services = await resolveServices(registry, { logger })
        const lifecycle = new Lifecycle({ registry, services, logger })

        await expect(lifecycle.boot()).rejects.toThrow(/\[module:posts\].*boom/)
        // posts did NOT complete onBoot, so its onShutdown must NOT run.
        expect(events).toEqual(['boot:users', 'boot:posts', 'shutdown:users'])
    })

    test('shutdown is idempotent', async () => {
        const calls: number[] = []
        const m = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => ({ findById: async ({ id }) => id }),
            onShutdown: () => {
                calls.push(1)
            },
        })
        const registry = new ModuleRegistry([m])
        const logger = makeLogger()
        const services = await resolveServices(registry, { logger })
        const lifecycle = new Lifecycle({ registry, services, logger })
        await lifecycle.boot()
        await lifecycle.shutdown()
        await lifecycle.shutdown()
        expect(calls.length).toBe(1)
    })

    test('records but does not throw on shutdown errors', async () => {
        const m = defineModule({
            name: 'users',
            provides: usersContract,
            implementation: () => ({ findById: async ({ id }) => id }),
            onShutdown: () => {
                throw new Error('cleanup-failed')
            },
        })
        const registry = new ModuleRegistry([m])
        const logger = makeLogger()
        const services = await resolveServices(registry, { logger })
        const lifecycle = new Lifecycle({ registry, services, logger })
        await lifecycle.boot()
        const report = await lifecycle.shutdown()
        expect(report.completed).toEqual([])
        expect(report.failed.length).toBe(1)
        expect(report.failed[0]!.module).toBe('users')
        expect(report.failed[0]!.error.message).toBe('cleanup-failed')
    })
})
