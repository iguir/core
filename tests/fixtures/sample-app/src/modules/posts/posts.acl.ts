import { defineAcl } from '../../../../../../src/acl/define'

export const postsAcl = defineAcl({
    module: 'posts',
    permissions: ['posts.list', 'posts.create', 'posts.delete'] as const,
    defaults: {
        admin: ['*'],
        editor: ['posts.list', 'posts.create'],
        viewer: ['posts.list'],
    },
    modes: { 'posts.delete': 'strict' },
})
