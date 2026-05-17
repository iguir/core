import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import type { ModuleLogger } from '../module/types'
import { AppError, RedirectError, ValidationError, isAppError } from './index'

/** Shape of the JSON body we send back for every error. */
export interface ErrorResponseBody {
    error: {
        code: string
        message: string
        status: number
        details?: unknown
    }
}

/** Options for the error handler factory. */
export interface ErrorHandlerOptions {
    logger?: ModuleLogger
    /**
     * Hide stack traces and raw messages from 5xx responses. Defaults to
     * `NODE_ENV === 'production'`.
     */
    hideInternals?: boolean
}

/**
 * Hono `onError` handler that maps:
 *   - `AppError`         → its declared status/code/details
 *   - `ZodError`         → 422 with flattened issues
 *   - `HTTPException`    → its status with `http.<status>` code
 *   - anything else      → 500 (message hidden when `hideInternals` is true)
 *
 * Registered globally by `bootstrap()` / `mount()` — modules don't have to
 * install it themselves.
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
    const hideInternals =
        options.hideInternals ?? process.env.NODE_ENV === 'production'

    return (err: Error, c: Context): Response => {
        // Redirects bypass the JSON-body path — emit a real redirect response
        // with the Location header. Loaders that throw RedirectError land here.
        if (err instanceof RedirectError) {
            return c.redirect(
                err.location,
                err.status as 301 | 302 | 303 | 307 | 308,
            )
        }

        const body = toErrorBody(err, hideInternals)

        if (options.logger) {
            const level = body.error.status >= 500 ? 'error' : 'warn'
            options.logger[level](
                {
                    err,
                    status: body.error.status,
                    code: body.error.code,
                    path: c.req.path,
                    method: c.req.method,
                },
                err.message,
            )
        }

        return c.json(body, body.error.status as ContentfulStatusCode)
    }
}

/** Pure helper: convert any thrown value to a structured response body. */
export function toErrorBody(
    err: unknown,
    hideInternals: boolean,
): ErrorResponseBody {
    if (err instanceof ZodError) {
        const ve = new ValidationError('Validation failed', flattenZodError(err))
        return appErrorToBody(ve)
    }

    if (err instanceof HTTPException) {
        return {
            error: {
                code: `http.${err.status}`,
                message: err.message || `HTTP ${err.status}`,
                status: err.status,
            },
        }
    }

    if (isAppError(err)) {
        return appErrorToBody(err)
    }

    const message = hideInternals
        ? 'Internal Server Error'
        : err instanceof Error
          ? err.message
          : String(err)

    return {
        error: {
            code: 'internal_server_error',
            message,
            status: 500,
        },
    }
}

function appErrorToBody(err: AppError): ErrorResponseBody {
    const body: ErrorResponseBody = {
        error: {
            code: err.code,
            message: err.message,
            status: err.status,
        },
    }
    if (err.details !== undefined) body.error.details = err.details
    return body
}

/** Reduce a ZodError to a stable, JSON-safe per-field issue list. */
function flattenZodError(err: ZodError): Array<{
    path: (string | number)[]
    code: string
    message: string
}> {
    return err.issues.map((issue) => ({
        path: issue.path as (string | number)[],
        code: issue.code,
        message: issue.message,
    }))
}
