import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { defineEvents } from '../define'
import { InMemoryEventBus } from '../memory'
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

const postsEvents = defineEvents('posts', {
    created: z.object({ id: z.string(), authorId: z.string() }),
})

describe('InMemoryEventBus', () => {
    test('registers + publishes to a subscriber', async () => {
        const bus = new InMemoryEventBus({ logger: silentLogger() })
        bus.registerAll(postsEvents)

        const received: unknown[] = []
        bus.subscribe(postsEvents.events['posts.created'], (p) => {
            received.push(p)
        })

        await bus.publish(postsEvents.events['posts.created'], {
            id: '1',
            authorId: 'a',
        })

        expect(received).toEqual([{ id: '1', authorId: 'a' }])
    })

    test('publishing an unregistered event throws', async () => {
        const bus = new InMemoryEventBus({ logger: silentLogger() })
        await expect(bus.publish('posts.unknown', {})).rejects.toThrow(
            /cannot publish unknown event/,
        )
    })

    test('payload validation throws ValidationError before fan-out', async () => {
        const bus = new InMemoryEventBus({ logger: silentLogger() })
        bus.registerAll(postsEvents)

        let called = false
        bus.subscribe('posts.created', () => {
            called = true
        })

        await expect(
            // @ts-expect-error — bad payload
            bus.publish(postsEvents.events['posts.created'], { id: 1 }),
        ).rejects.toThrow(/payload failed validation/)
        expect(called).toBe(false)
    })

    test('subscriber errors are logged but do not break the publish', async () => {
        const errors: unknown[] = []
        const logger: ModuleLogger = {
            info() {},
            warn() {},
            debug() {},
            error: (...args) => errors.push(args),
            child() {
                return logger
            },
        }
        const bus = new InMemoryEventBus({ logger })
        bus.registerAll(postsEvents)

        bus.subscribe('posts.created', () => {
            throw new Error('handler-failed')
        })
        let okCalled = false
        bus.subscribe('posts.created', () => {
            okCalled = true
        })

        await bus.publish(postsEvents.events['posts.created'], {
            id: '1',
            authorId: 'a',
        })

        expect(okCalled).toBe(true)
        expect(errors.length).toBe(1)
    })

    test('unsubscribe removes the subscriber', async () => {
        const bus = new InMemoryEventBus({ logger: silentLogger() })
        bus.registerAll(postsEvents)
        let count = 0
        const off = bus.subscribe('posts.created', () => {
            count++
        })
        await bus.publish(postsEvents.events['posts.created'], {
            id: '1',
            authorId: 'a',
        })
        off()
        await bus.publish(postsEvents.events['posts.created'], {
            id: '2',
            authorId: 'a',
        })
        expect(count).toBe(1)
    })

    test('duplicate registration with the same schema is fine; different throws', () => {
        const bus = new InMemoryEventBus({ logger: silentLogger() })
        bus.registerAll(postsEvents)
        expect(() => bus.registerAll(postsEvents)).not.toThrow()

        const other = defineEvents('posts', {
            created: z.object({ id: z.number() }),
        })
        expect(() => bus.registerAll(other)).toThrow(/different schemas/)
    })
})
