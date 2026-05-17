import { z } from 'zod'
import { defineEnv } from '@iguir/core'

export const env = defineEnv(
    z.object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

        // Default points at the docker-compose Postgres. Override via .env for staging/prod.
        DATABASE_URL: z
            .string()
            .default('postgres://postgres:postgres@localhost:5432/{{name}}'),

        // Cookie + session config.
        SESSION_COOKIE_NAME: z.string().default('{{name}}_session'),
        SESSION_TTL_MS: z.coerce.number().int().positive().default(30 * 24 * 60 * 60 * 1000),
    }),
)
