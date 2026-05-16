import type { ZodType, z } from 'zod'

/** A single event declaration: name + payload schema. */
export interface EventDefinition<TSchema extends ZodType = ZodType> {
    readonly name: string
    readonly schema: TSchema
}

/** Map of (short) event name → Zod schema, declared in `defineEvents()`. */
export type EventsSchemaMap = Record<string, ZodType>

/**
 * The frozen result of `defineEvents(module, schemas)`. Carries one
 * `EventDefinition` per event, with the full dotted name (`module.shortName`).
 * Used as both the runtime registration AND the publish-side typing entry.
 */
export interface DefinedEvents<
    TModule extends string = string,
    TSchemas extends EventsSchemaMap = EventsSchemaMap,
> {
    readonly __kind: 'app:events'
    readonly module: TModule
    /** Full event name (`module.shortName`) → its definition. */
    readonly events: {
        readonly [K in keyof TSchemas & string as `${TModule}.${K}`]: EventDefinition<
            TSchemas[K]
        >
    }
}

const MODULE_NAME_RE = /^[a-z][a-z0-9_]*$/
const SHORT_NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

/**
 * Declare a module's emittable events with their Zod payload schemas.
 *
 *   export const postsEvents = defineEvents('posts', {
 *     created: z.object({ id: z.string(), authorId: z.string() }),
 *     updated: z.object({ id: z.string(), changes: z.record(z.unknown()) }),
 *   })
 *
 * The result is stored on `defineModule({ events: ... })`; the bus uses it to
 * validate payloads at publish time so subscribers always see well-typed data.
 */
export function defineEvents<
    const TModule extends string,
    const TSchemas extends EventsSchemaMap,
>(module: TModule, schemas: TSchemas): DefinedEvents<TModule, TSchemas> {
    if (!MODULE_NAME_RE.test(module)) {
        throw new Error(
            `[events] module "${module}" is invalid. ` +
                'Use lowercase letters, digits, and underscores; must start with a letter.',
        )
    }

    const tag = `[events:${module}]`
    const keys = Object.keys(schemas)
    if (keys.length === 0) {
        throw new Error(`${tag} at least one event must be declared`)
    }

    const events: Record<string, EventDefinition> = {}
    for (const key of keys) {
        if (!SHORT_NAME_RE.test(key)) {
            throw new Error(
                `${tag} event short-name "${key}" is invalid. ` +
                    'Use lowercase letters, digits, underscores, optionally dotted.',
            )
        }
        const schema = schemas[key]
        if (
            !schema ||
            typeof (schema as { parse?: unknown }).parse !== 'function'
        ) {
            throw new Error(`${tag}.${key} payload must be a Zod schema`)
        }
        events[`${module}.${key}`] = { name: `${module}.${key}`, schema }
    }

    return Object.freeze({
        __kind: 'app:events' as const,
        module,
        events: events as DefinedEvents<TModule, TSchemas>['events'],
    })
}

/** Helper: infer the payload type for an event definition. */
export type EventPayload<TDef extends EventDefinition> = z.infer<TDef['schema']>
