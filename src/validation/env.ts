import { ZodError, type ZodType, type z } from 'zod'

/** A typed environment object — `z.infer<>` of the schema you supplied. */
export type Env<TSchema extends ZodType> = z.infer<TSchema>

/** Options for `defineEnv`. */
export interface DefineEnvOptions {
    /**
     * The source map to validate. Defaults to `process.env` — override for
     * tests or when reading from `Bun.env` / a `.env.local` parse.
     */
    source?: Record<string, string | undefined>
    /**
     * Tag used in error messages so the failure points at the right place
     * ("[env] FOO is required"). Defaults to "env".
     */
    tag?: string
}

/**
 * Validate the environment at startup and return a typed object.
 *
 *   const env = defineEnv(z.object({
 *     DATABASE_URL: z.string().url(),
 *     PORT: z.coerce.number().default(3000),
 *     LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
 *   }))
 *
 *   env.PORT   // number, fully typed
 *
 * Throws synchronously with a formatted multi-line error if anything is
 * missing or malformed — Bun's auto-loaded `.env` is consulted first. There
 * is no "we'll figure it out at first request" path; misconfiguration must
 * be loud.
 */
export function defineEnv<TSchema extends ZodType>(
    schema: TSchema,
    options: DefineEnvOptions = {},
): Env<TSchema> {
    const tag = `[${options.tag ?? 'env'}]`
    const source = options.source ?? (process.env as Record<string, string | undefined>)

    const result = schema.safeParse(source)
    if (result.success) return result.data as Env<TSchema>

    throw new Error(`${tag} environment validation failed:\n${formatIssues(result.error)}`)
}

function formatIssues(err: ZodError): string {
    return err.issues
        .map((i) => {
            const path = i.path.length > 0 ? i.path.join('.') : '<root>'
            return `  - ${path}: ${i.message}`
        })
        .join('\n')
}
