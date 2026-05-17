import type { ZodType } from 'zod'

/** Shape of a single contract method: input + output Zod schemas. */
export interface ContractMethod<
    TInput extends ZodType = ZodType,
    TOutput extends ZodType = ZodType,
> {
    readonly input: TInput
    readonly output: TOutput
}

/** Map of method name → contract method. */
export type ContractMethods = Record<string, ContractMethod>

/**
 * A frozen contract describing what a module exposes to the rest of the app.
 *
 * Other modules import the contract object (only from `*.contract.ts` files —
 * see the Biome `noRestrictedImports` rule) and use the typed methods. In v1
 * (monolith) the implementation is invoked directly; in v1.1+ the same contract
 * is the source of truth for the HTTP RPC client/server.
 */
export interface ModuleContract<
    TName extends string = string,
    TMethods extends ContractMethods = ContractMethods,
> {
    readonly name: TName
    readonly methods: TMethods
}

const CONTRACT_NAME_RE = /^[a-z][a-z0-9_]*$/
const METHOD_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/

/**
 * Define a module's outward contract. Call this in `<module>.contract.ts`.
 * Validates at module-load time so typos surface immediately.
 *
 *   export const usersContract = defineContract('users', {
 *     findById: { input: z.object({ id: z.string() }), output: UserSchema.nullable() },
 *     create:   { input: CreateUserSchema, output: UserSchema },
 *   })
 */
export function defineContract<
    const TName extends string,
    const TMethods extends ContractMethods,
>(name: TName, methods: TMethods): ModuleContract<TName, TMethods> {
    validate(name, methods)
    return Object.freeze({ name, methods }) as ModuleContract<TName, TMethods>
}

function validate(name: string, methods: ContractMethods): void {
    if (!name || typeof name !== 'string') {
        throw new Error('[contract] defineContract: `name` is required')
    }
    if (!CONTRACT_NAME_RE.test(name)) {
        throw new Error(
            `[contract] name "${name}" is invalid. ` +
                'Use lowercase letters, digits, and underscores; must start with a letter.',
        )
    }

    const tag = `[contract:${name}]`
    if (!methods || typeof methods !== 'object') {
        throw new Error(`${tag} methods must be an object`)
    }

    const keys = Object.keys(methods)
    if (keys.length === 0) {
        throw new Error(`${tag} at least one method must be defined`)
    }

    for (const key of keys) {
        if (!METHOD_NAME_RE.test(key)) {
            throw new Error(
                `${tag} method name "${key}" is invalid. ` +
                    'Use camelCase identifiers (letters, digits, underscores).',
            )
        }

        const method = methods[key]
        if (!method || typeof method !== 'object') {
            throw new Error(`${tag}.${key} must be { input, output }`)
        }
        if (!isZodSchema(method.input)) {
            throw new Error(`${tag}.${key}: \`input\` must be a Zod schema`)
        }
        if (!isZodSchema(method.output)) {
            throw new Error(`${tag}.${key}: \`output\` must be a Zod schema`)
        }
    }
}

function isZodSchema(value: unknown): value is ZodType {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as { parse?: unknown }).parse === 'function' &&
        typeof (value as { safeParse?: unknown }).safeParse === 'function'
    )
}
