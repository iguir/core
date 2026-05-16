import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineRoles } from '../../acl/roles'
import { defineEvents } from '../../events/define'
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

const roles = defineRoles({ admin: { description: 'Admin' } })

describe('bootstrap event wiring', () => {
    test('module subscriptions receive events published on the bus', async () => {
        const usersEvents = defineEvents('users', {
            created: z.object({ id: z.string(), email: z.string() }),
        })

        const received: unknown[] = []

        const usersModule = defineModule({
            name: 'users',
            events: usersEvents,
        })

        const emailModule = defineModule({
            name: 'email',
            subscriptions: {
                'users.created': (payload) => {
                    received.push(payload)
                },
            },
        })

        const { bus } = await bootstrap({
            roles,
            modules: [usersModule, emailModule],
            logger: silentLogger(),
        })

        await bus.publish(usersEvents.events['users.created'], {
            id: '1',
            email: 'a@b.c',
        })

        expect(received).toEqual([{ id: '1', email: 'a@b.c' }])
    })

    test('subscribing to an unregistered event still fails at publish', async () => {
        const emailModule = defineModule({
            name: 'email',
            subscriptions: {
                'ghosts.spotted': () => {},
            },
        })

        const { bus } = await bootstrap({
            roles,
            modules: [emailModule],
            logger: silentLogger(),
        })

        await expect(bus.publish('ghosts.spotted', {})).rejects.toThrow(
            /cannot publish unknown event/,
        )
    })
})
