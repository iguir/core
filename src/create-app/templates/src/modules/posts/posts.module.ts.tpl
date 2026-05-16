import { defineModule } from '@iguir/core/module/define'
import { postsAcl } from './posts.acl'
import { postsContract } from './posts.contract'
import { createPostsService } from './services/index'
import { createApiRoutes } from './routes/api'

const service = createPostsService()

export const postsModule = defineModule({
    name: 'posts',
    provides: postsContract,
    acl: postsAcl,
    implementation: () => ({
        list: async () => service.list(),
        findById: async ({ id }) => service.findById(id),
    }),
    routes: { handler: createApiRoutes(service), prefix: '/api/posts' },
})
