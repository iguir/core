import { createPostgresDb } from '@iguir/core'
import * as schema from './schema'
import { env } from './env'

/**
 * Single Drizzle client for the app. Modules pull it in through their
 * implementation factories — see `src/modules/auth/auth.module.ts`.
 *
 * `Bun.sql` handles connection pooling + reconnects under the hood.
 */
export const db = createPostgresDb({
    url: env.DATABASE_URL,
    schema,
})

export type AppSchema = typeof schema
