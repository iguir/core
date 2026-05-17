import { defineConfig } from '@iguir/core'
import { roles } from './src/app/acl'
import { auth } from './src/app/auth'
import { postsModule } from './src/modules/posts/posts.module'

export default defineConfig({
    roles,
    modules: [auth, postsModule],
    server: { port: 3000 },
})
