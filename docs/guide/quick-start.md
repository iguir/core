# Quick start

A working app in five minutes.

## Scaffold

```sh
bunx create-iguir my-app
cd my-app
bun install
```

## Look around

`app.config.ts` is the entry the CLI + the bootstrapper both read:

```ts
import { defineConfig } from '@iguir/core/config'
import { roles } from './src/app/acl'
import { auth } from './src/app/auth'
import { postsModule } from './src/modules/posts/posts.module'

export default defineConfig({
    roles,
    modules: [auth, postsModule],
    server: { port: 3000 },
})
```

Roles are declared once, app-wide:

```ts
// src/app/acl.ts
import { defineRoles } from '@iguir/core/acl/roles'

export const roles = defineRoles({
    admin: { description: 'Full access', system: true },
    editor: { description: 'Can create + edit' },
    viewer: { description: 'Read-only' },
    customer: { description: 'Default for new sign-ups' },
})
```

A module declares its name, ACL, contract, routes, and (optionally) services:

```ts
// src/modules/posts/posts.module.ts
import { defineModule } from '@iguir/core/module/define'
import { postsAcl } from './posts.acl'
import { postsContract } from './posts.contract'
import { createPostsService } from './services'
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
```

Routes are typed against the validators they declare:

```ts
// src/modules/posts/routes/api.ts
r.post(
    '/',
    { auth: true, permission: 'posts.create', body: CreatePostBody },
    (c) => {
        const input = c.req.valid('json')      // typed from CreatePostBody
        const created = service.create(input)
        return c.json(created, 201)
    },
)
```

## Run

```sh
bun dev               # bun --hot + vite (when vite.config.ts exists)
```

Open `http://localhost:3000/api/posts/health`. Then:

```sh
curl -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"longenoughpw"}'
```

## Inspect

```sh
bunx iguir routes      # every route + permission
bunx iguir acl         # roles + permissions + grants
bunx iguir openapi     # OpenAPI 3.1 to stdout
```

## Test

The framework ships a `testApp()` helper so you can exercise the whole stack without spinning up a server:

```ts
import { testApp } from '@iguir/core/testing'

const app = await testApp({
    roles,
    modules: [auth, postsModule],
    user: { id: 'u1', roles: ['editor'] },
})
const { status, body } = await app.json('/api/posts')
```

→ Keep going: [Modules & contracts](./modules).
