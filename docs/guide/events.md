# Events

In-process pub/sub with Zod-validated payloads. Drives loose coupling between modules without forcing them to know each other.

## `defineEvents`

```ts
import { z } from 'zod'
import { defineEvents } from '@iguir/core/events/define'

export const postsEvents = defineEvents('posts', {
    'created': z.object({ id: z.string(), authorId: z.string() }),
    'updated': z.object({ id: z.string(), changes: z.record(z.unknown()) }),
})
```

Event names are namespaced by the module — `posts.created`, `posts.updated`. The module owning the events declares them on its `defineModule({ events: postsEvents })`.

## Publishing

The live event bus is available on `onBoot`'s context and on request contexts:

```ts
defineModule({
    name: 'posts',
    events: postsEvents,
    implementation: ({ logger }) => {
        // The bus isn't ready yet inside `implementation` — use a ref pattern:
        let bus: EventBus
        return {
            create: async (input) => {
                const post = await db.create(input)
                await bus.publish(postsEvents.events['posts.created'], {
                    id: post.id, authorId: post.authorId,
                })
                return post
            },
        }
    },
    onBoot: ({ bus: liveBus }) => {
        bus = liveBus
    },
})
```

Payloads are validated against the schema before fan-out; a payload mismatch throws `ValidationError` from the publisher.

## Subscribing

```ts
defineModule({
    name: 'email',
    subscriptions: {
        'posts.created': async (payload) => {
            await sendNotification(payload)
        },
    },
})
```

Subscribers run concurrently (`Promise.allSettled`). A failing subscriber is logged but doesn't break the publish — every other handler still runs.

## Inspect

The bus tracks every registered event for the upcoming `iguir events` CLI:

```ts
bus.registeredEvents()                           // ['auth.user.registered', 'posts.created', ...]
```

## Replacing the bus

Default implementation is in-process. Swap it via config:

```ts
import { InMemoryEventBus } from '@iguir/core/events/memory'

defineConfig({
    eventBus: new MyRedisBus({ ... }),           // any EventBus implementation
    ...
})
```

The `EventBus` interface in `@iguir/core/events/bus` is the contract; the in-memory class is one concrete implementation. Redis/NATS land in v1.1.

→ Next: [JSX, pages & islands](./jsx).
