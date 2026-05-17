import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino'
import type { ModuleLogger } from '../module/types'

/** Options accepted by `createLogger`. Mirrors a useful subset of pino's. */
export interface CreateLoggerOptions extends LoggerOptions {
    /**
     * Pretty-print log output (human-friendly). Defaults to true when
     * `NODE_ENV !== 'production'`. In production, JSON is left intact so log
     * pipelines (Loki, Datadog, etc.) can ingest it.
     */
    pretty?: boolean
}

/**
 * Build a Pino logger and adapt it to the framework's structural `ModuleLogger`.
 * Returned object is a `pino.Logger` plus the `ModuleLogger` surface — same
 * instance, two interfaces. Drop-in replaceable wherever `ModuleLogger` is
 * expected.
 *
 *   const logger = createLogger({ level: 'debug', pretty: true })
 *   await bootstrap({ ..., logger })
 */
export function createLogger(opts: CreateLoggerOptions = {}): ModuleLogger & PinoLogger {
    const { pretty = process.env.NODE_ENV !== 'production', ...rest } = opts

    const options: LoggerOptions = {
        level: rest.level ?? process.env.LOG_LEVEL ?? 'info',
        ...rest,
        ...(pretty
            ? {
                  transport: {
                      target: 'pino-pretty',
                      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
                  },
              }
            : {}),
    }

    // Pino throws synchronously at construction if `pino-pretty` is missing;
    // catch and fall back to JSON so the framework still boots in stripped
    // production images.
    try {
        return pino(options) as ModuleLogger & PinoLogger
    } catch {
        const fallback = { ...options }
        delete (fallback as { transport?: unknown }).transport
        return pino(fallback) as ModuleLogger & PinoLogger
    }
}

/** Re-export pino's Logger type for downstream consumers that want it. */
export type { PinoLogger }
