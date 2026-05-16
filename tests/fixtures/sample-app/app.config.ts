import { defineConfig } from '../../../src/config'
import { defineRoles } from '../../../src/acl/roles'
import { postsModule } from './src/modules/posts/posts.module'

const roles = defineRoles({
    admin: { description: 'Admin', system: true },
    editor: { description: 'Editor' },
    viewer: { description: 'Viewer' },
})

export default defineConfig({
    roles,
    modules: [postsModule],
    server: { port: 3000 },
})
