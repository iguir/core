import type { ZodType } from 'zod'
import type { ModuleLogger } from '../module/types'
import { ValidationError } from '../errors/index'
import {
    type EventBus,
    type EventBusDeps,
    type Subscriber,
    type Unsubscribe,
    eventName,
} from './bus'
import type {
    DefinedEvents,
    EventDefinition,
    EventPayload,
} from './define'

/**
 * In-process event bus. Fan-out subscribers run concurrently via
 * `Promise.all`; per-subscriber errors are caught and logged so a buggy
 * handler can't sink the whole publish.
 *
 * Replaceable: any class satisfying `EventBus` (Redis pub/sub, NATS, etc.)
 * can drop in. The runtime contract is stable.
 */
export class InMemoryEventBus implements EventBus {
    private readonly schemas = new Map<string, ZodType | undefined>()
    private readonly subscribers = new Map<string, Set<Subscriber>>()
    private readonly logger: ModuleLogger

    constructor(deps: EventBusDeps) {
        this.logger = deps.logger
    }

    register(definition: EventDefinition): void {
        const { name, schema } = definition
        const existing = this.schemas.get(name)
        if (existing && existing !== schema) {
            throw new Error(
                `[events] event "${name}" registered more than once with different schemas`,
            )
        }
        this.schemas.set(name, schema)
    }

    registerAll(defined: DefinedEvents): void {
        for (const def of Object.values(defined.events)) {
            this.register(def)
        }
    }

    subscribe<TDef extends EventDefinition>(
        event: TDef | string,
        handler: Subscriber<TDef extends EventDefinition ? EventPayload<TDef> : unknown>,
    ): Unsubscribe {
        const name = eventName(event)
        if (typeof handler !== 'function') {
            throw new TypeError(
                `[events:${name}] subscribe: handler must be a function`,
            )
        }
        const set = this.subscribers.get(name) ?? new Set<Subscriber>()
        set.add(handler as Subscriber)
        this.subscribers.set(name, set)
        return () => {
            set.delete(handler as Subscriber)
            if (set.size === 0) this.subscribers.delete(name)
        }
    }

    async publish<TDef extends EventDefinition>(
        event: TDef | string,
        payload: TDef extends EventDefinition ? EventPayload<TDef> : unknown,
    ): Promise<void> {
        const name = eventName(event)

        if (!this.schemas.has(name)) {
            throw new Error(
                `[events] cannot publish unknown event "${name}". ` +
                    'Did you forget to register it via defineEvents() / bus.registerAll()?',
            )
        }

        const schema = this.schemas.get(name)
        if (schema) {
            const result = schema.safeParse(payload)
            if (!result.success) {
                throw new ValidationError(
                    `[events:${name}] payload failed validation`,
                    result.error.issues.map((i) => ({
                        path: i.path,
                        code: i.code,
                        message: i.message,
                    })),
                )
            }
        }

        const subs = this.subscribers.get(name)
        if (!subs || subs.size === 0) return

        // Snapshot the subscriber set: handlers may subscribe/unsubscribe inside
        // their callback without disturbing the current publish pass.
        const handlers = [...subs]
        const results = await Promise.allSettled(
            handlers.map((h) => Promise.resolve().then(() => h(payload))),
        )

        for (let i = 0; i < results.length; i++) {
            const r = results[i]!
            if (r.status === 'rejected') {
                this.logger.error(
                    { event: name, err: r.reason },
                    `[events:${name}] subscriber threw`,
                )
            }
        }
    }

    registeredEvents(): readonly string[] {
        return [...this.schemas.keys()].sort()
    }
}
