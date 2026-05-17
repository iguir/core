import type { Context, MiddlewareHandler } from 'hono'
import type { ModuleLogger } from '../module/types'

/** Context variables added by the logger middleware. */
export interface LoggerVariables {
    /** Per-request child logger pre-bound with `reqId`, method, path. */
    logger: ModuleLogger
    /** Stable per-request identifier. */
    reqId: string
}

declare module 'hono' {
    interface ContextVariableMap extends LoggerVariables {}
}

/** Options for the request logger middleware. */
export interface RequestLoggerOptions {
    /** Root logger to derive per-request child loggers from. */
    logger: ModuleLogger
    /**
     * Function that produces a request id. Defaults to `crypto.randomUUID()`.
     * Can be replaced to honour upstream `x-request-id` headers.
     */
    genReqId?: (c: Context) => string
    /** When true (default) emit a structured access log per request. */
    accessLog?: boolean
}

/**
 * Hono middleware that:
 *   1. Generates a stable `reqId` for the request (honouring `x-request-id`).
 *   2. Attaches a per-request child logger to `c.var.logger`.
 *   3. Emits a single access-log line on response with status + duration.
 *
 * Installed globally by `bootstrap()` so every module sees the same logging
 * conventions. Drop down to `c.var.logger` for handler-level logging.
 */
export function requestLogger(
    options: RequestLoggerOptions,
): MiddlewareHandler {
    const accessLog = options.accessLog ?? true
    const genReqId =
        options.genReqId ??
        ((c) => c.req.header('x-request-id') ?? crypto.randomUUID())

    return async (c, next) => {
        const reqId = genReqId(c)
        const child = options.logger.child({
            reqId,
            method: c.req.method,
            path: c.req.path,
        })
        c.set('reqId', reqId)
        c.set('logger', child)

        const start = performance.now()
        try {
            await next()
        } finally {
            if (accessLog) {
                const ms = Math.round((performance.now() - start) * 100) / 100
                child.info({ status: c.res.status, ms }, 'request')
            }
        }
    }
}
