import { z } from 'zod'
import { defineEnv } from '@iguir/core'

export const env = defineEnv(
    z.object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    }),
)
