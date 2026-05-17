import type { ZodType } from 'zod'
import type { ModuleLogger } from '../module/types'
import type { DefinedEvents, EventDefinition, EventPayload } from './define'

/** A subscriber callback. Awaited if it returns a promise. */
export type Subscriber<TPayload = unknown> = (
    payload: TPayload,
) => void | Promise<void>

/** Disposer returned by `bus.subscribe(...)`. */
export type Unsubscribe = () => void

/** What the bus needs from the surrounding world. */
export interface EventBusDeps {
    logger: ModuleLogger
}

/**
 * Generic event bus interface. The in-memory implementation lives in
 * `events/memory.ts`; later runtimes (Redis, NATS, …) will satisfy the same
 * shape so swapping is a one-line change.
 */
export interface EventBus {
    /** Register an event so `publish()` knows its payload schema. */
    register(definition: EventDefinition): void

    /** Bulk-register every event in a `defineEvents()` result. */
    registerAll(defined: DefinedEvents): void

    /** Subscribe to an event by full name. */
    subscribe<TDef extends EventDefinition>(
        event: TDef | string,
        handler: Subscriber<TDef extends EventDefinition ? EventPayload<TDef> : unknown>,
    ): Unsubscribe

    /**
     * Publish an event. Payload is validated against the registered Zod schema;
     * a registration mismatch or schema failure throws synchronously so bugs
     * surface at the emitter, not at the subscriber.
     */
    publish<TDef extends EventDefinition>(
        event: TDef | string,
        payload: TDef extends EventDefinition ? EventPayload<TDef> : unknown,
    ): Promise<void>

    /** Names of all registered events — useful for `iguir events` CLI. */
    registeredEvents(): readonly string[]
}

/** Helper: pluck a dotted event name from either a string or definition. */
export function eventName(event: EventDefinition | string): string {
    return typeof event === 'string' ? event : event.name
}

/** Helper: pluck a Zod schema from a definition, if available. */
export function eventSchema(
    event: EventDefinition | string,
): ZodType | undefined {
    return typeof event === 'string' ? undefined : event.schema
}
