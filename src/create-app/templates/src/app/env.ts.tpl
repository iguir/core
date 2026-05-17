import { z } from 'zod'
import { defineEnv } from '@iguir/core/validation/env'

export const env = defineEnv(
    z.object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        DATABASE_URL: z.string().default('file:./data.db'),
        LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    }),
)
