import { defineAcl } from '@iguir/core'

/**
 * Auth module permissions. Both default to `strict` mode — role grants only,
 * per-user grants ignored. No way for a user to elevate themselves via grants.
 */
export const authAcl = defineAcl({
    module: 'auth',
    permissions: ['auth.users.list', 'auth.users.manage'] as const,
    defaults: {
        admin: ['*'],
    },
    modes: {
        'auth.users.list': 'strict',
        'auth.users.manage': 'strict',
    },
})
