import { defineAcl } from '@iguir/core/acl/define'

export const postsAcl = defineAcl({
    module: 'posts',
    permissions: ['posts.list', 'posts.create', 'posts.delete'] as const,
    defaults: {
        admin: ['*'],
        editor: ['posts.list', 'posts.create'],
        viewer: ['posts.list'],
        customer: ['posts.list'],
    },
    modes: { 'posts.delete': 'strict' },
})
