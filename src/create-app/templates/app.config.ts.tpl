import { defineConfig } from '@iguir/core'
import { roles } from './src/app/acl'
import { postsModule } from './src/modules/posts/posts.module'

export default defineConfig({
    roles,
    modules: [postsModule],
    server: { port: 3000 },
})
