import { defineModule } from '@iguir/core'
import { db } from '../../app/db'
import { env } from '../../app/env'
import { authAcl } from './auth.acl'
import { authContract } from './auth.contract'
import { authEvents } from './events'
import { createSessionMiddleware } from './middleware'
import { createApiRoutes } from './routes/api'
import { createAuthService, toPublicUser } from './services/index'

// One service instance per process — wraps every Drizzle query the module needs.
const service = createAuthService(db.drizzle)

// `bus` is captured at onBoot time. Until then, publishes from the contract
// (called from other modules' onBoot) go nowhere safely.
let publishImpl: (event: unknown, payload: unknown) => Promise<void> = async () => {}

export const authModule = defineModule({
    name: 'auth',
    provides: authContract,
    acl: authAcl,
    events: authEvents,

    implementation: ({ logger }) => ({
        async findUserById({ id }) {
            const u = await service.findUserById(id)
            return u ? toPublicUser(u) : null
        },
        async findUserByEmail({ email }) {
            const u = await service.findUserByEmail(email)
            return u ? toPublicUser(u) : null
        },
        async registerUser(input) {
            const existing = await service.findUserByEmail(input.email)
            if (existing) {
                throw new Error(`[auth] email "${input.email}" already in use`)
            }
            const user = await service.createUser({
                email: input.email,
                password: input.password,
                roles: input.roles,
            })
            const pub = toPublicUser(user)
            await publishImpl(authEvents.events['auth.user.registered'], pub)
            logger.info({ userId: user.id }, 'user registered')
            return pub
        },
        async verifyPassword({ email, password }) {
            const u = await service.verifyPassword(email, password)
            return u ? toPublicUser(u) : null
        },
    }),

    globalMiddleware: [
        createSessionMiddleware({
            cookieName: env.SESSION_COOKIE_NAME,
            service,
        }),
    ],

    routes: {
        handler: createApiRoutes({
            service,
            cookieName: env.SESSION_COOKIE_NAME,
            cookieSecure: env.NODE_ENV === 'production',
            sessionTtlMs: env.SESSION_TTL_MS,
            publish: (event, payload) => publishImpl(event, payload),
        }),
        prefix: '/auth',
    },

    onBoot: ({ bus }) => {
        // Swap the no-op for the live bus once bootstrap has it wired.
        publishImpl = (event, payload) =>
            bus.publish(event as never, payload as never)
    },

    onShutdown: async () => {
        await db.close()
    },
})
