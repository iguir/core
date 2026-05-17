import type { MiddlewareHandler } from 'hono'
import { validator as honoValidator } from 'hono/validator'
import { ZodError, type ZodType, type z } from 'zod'
import { ValidationError } from '../errors/index'

/** Which part of the request a schema targets. */
export type ValidationTarget = 'json' | 'query' | 'param' | 'header'

/** Map of validators a route can declare. */
export interface RouteValidators {
    body?: ZodType
    query?: ZodType
    param?: ZodType
    header?: ZodType
}

/**
 * Create a middleware that validates one part of the request against `schema`,
 * and exposes the parsed value via `c.req.valid(target)`.
 *
 *   r.post('/', { body: PostSchema }, async (c) => {
 *     const data = c.req.valid('json')   // typed as z.infer<typeof PostSchema>
 *   })
 *
 * On failure, throws `ValidationError` — caught and rendered by the global
 * error handler with status 422 and per-field details.
 */
export function validator<TSchema extends ZodType>(
    target: ValidationTarget,
    schema: TSchema,
): MiddlewareHandler {
    const mw = honoValidator(target, (value) => {
        const result = schema.safeParse(value)
        if (!result.success) {
            throw new ValidationError(
                `Invalid ${target === 'json' ? 'body' : target}`,
                flattenZodError(result.error, target),
            )
        }
        return result.data as z.infer<TSchema>
    })
    // Hono's validator returns a more specific Variables map than the generic
    // MiddlewareHandler; the framework layer treats it as the latter.
    return mw as unknown as MiddlewareHandler
}

/**
 * Convenience: produce one or more validator middlewares from a `RouteValidators`
 * object. Returns an array in a stable order — body first (cheapest to fail),
 * then query, param, header.
 */
export function validatorsFor(v: RouteValidators): MiddlewareHandler[] {
    const out: MiddlewareHandler[] = []
    if (v.body) out.push(validator('json', v.body))
    if (v.query) out.push(validator('query', v.query))
    if (v.param) out.push(validator('param', v.param))
    if (v.header) out.push(validator('header', v.header))
    return out
}

function flattenZodError(
    err: ZodError,
    target: ValidationTarget,
): Array<{
    target: ValidationTarget
    path: (string | number)[]
    code: string
    message: string
}> {
    return err.issues.map((issue) => ({
        target,
        path: issue.path as (string | number)[],
        code: issue.code,
        message: issue.message,
    }))
}

/** Helper alias: infer the parsed type of a validator schema. */
export type Infer<TSchema extends ZodType> = z.infer<TSchema>
