import {
    createAuthModule,
    DrizzleSessionStore,
    DrizzleUserStore,
} from '@iguir/core'
import { db } from './db'
import { env } from './env'

export const auth = createAuthModule({
    userStore: new DrizzleUserStore({ drizzle: db.drizzle }),
    sessionStore: new DrizzleSessionStore({ drizzle: db.drizzle }),
    cookieSecure: env.NODE_ENV === 'production',
})
