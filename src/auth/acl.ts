import { defineAcl } from '../acl/define'

/**
 * Permissions owned by the auth module. By default we ship two:
 *   - `auth.users.list`     — read any user (admin tooling).
 *   - `auth.users.manage`   — create/disable/promote users.
 *
 * Both are `strict` so per-user grants can't escalate; only role grants count.
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
