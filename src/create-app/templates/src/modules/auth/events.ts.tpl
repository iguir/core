import { z } from 'zod'
import { defineEvents } from '@iguir/core'
import { PublicUserSchema } from './auth.contract'

/**
 * Domain events emitted by the auth module. Subscribers (welcome email,
 * audit log, billing, etc.) consume these — auth itself never imports them.
 */
export const authEvents = defineEvents('auth', {
    'user.registered': PublicUserSchema,
    'user.logged_in': z.object({ userId: z.string(), sessionId: z.string() }),
    'user.logged_out': z.object({ userId: z.string(), sessionId: z.string() }),
})
