import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineRoles } from '../../acl/roles'
import { defineAcl } from '../../acl/define'
import { defineContract } from '../../module/contract'
import { defineModule } from '../../module/define'
import { bootstrap } from '../index'
import type { ModuleLogger } from '../../module/types'

function silentLogger(): ModuleLogger {
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

const roles = defineRoles({
    admin: { description: 'Admin' },
    viewer: { description: 'Viewer' },
})

describe('bootstrap', () => {
    test('wires modules end-to-end and returns a Hono app', async () => {
        const usersAcl = defineAcl({
            module: 'users',
            permissions: ['users.read'] as const,
            defaults: { admin: ['*'], viewer: ['users.read'] },
        })

        const users = defineModule({
            name: 'users',
            provides: usersContract,
            acl: usersAcl,
            implementation: () => ({ findById: async ({ id }) => id }),
        })

        const result = await bootstrap({
            roles,
            modules: [users],
            logger: silentLogger(),
        })

        expect(result.modules.has('users')).toBe(true)
        expect(result.acl.allPermissions()).toContain('users.read')
        expect(await result.services.require(usersContract).findById({ id: '1' }))
            .toBe('1')
        // Hono app responds 404 on an unknown route — proof it's wired.
        const res = await result.app.request('/nope')
        expect(res.status).toBe(404)

        await result.lifecycle.shutdown()
    })

    test('fails loudly on unsatisfied imports', async () => {
        const orphan = defineModule({
            name: 'posts',
            imports: [usersContract],
        })
        expect(
            bootstrap({
                roles,
                modules: [orphan],
                logger: silentLogger(),
            }),
        ).rejects.toThrow(/no module provides it/)
    })

    test('rolls back booted modules when onBoot throws', async () => {
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
        const breaker = defineModule({
            name: 'breaker',
            imports: [usersContract],
            onBoot: () => {
                events.push('boot:breaker')
                throw new Error('nope')
            },
        })

        await expect(
            bootstrap({
                roles,
                modules: [users, breaker],
                logger: silentLogger(),
            }),
        ).rejects.toThrow(/breaker.*nope/)

        expect(events).toEqual(['boot:users', 'boot:breaker', 'shutdown:users'])
    })
})
