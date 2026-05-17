import { defineConfig } from '@iguir/core'
import { roles } from './src/app/acl'
import { authModule } from './src/modules/auth/auth.module'

export default defineConfig({
    roles,
    modules: [authModule],
    server: { port: 3000 },
})
