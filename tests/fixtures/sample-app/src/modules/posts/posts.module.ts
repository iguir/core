import { defineModule } from '../../../../../../src/module/define'
import { postsAcl } from './posts.acl'
import { apiRoutes } from './api'

export const postsModule = defineModule({
    name: 'posts',
    acl: postsAcl,
    routes: { handler: apiRoutes, prefix: '/api/posts' },
})
