import {
    createSqliteDb,
    authSchema,
    createAuthTablesIfMissing,
} from '@iguir/core/db'
import { env } from './env'

export const db = createSqliteDb({
    url: env.DATABASE_URL,
    schema: authSchema,
})

// Idempotent — safe to run on every boot. For production, replace with
// `drizzle-kit` migrations.
createAuthTablesIfMissing(db.raw)
