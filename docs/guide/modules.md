# Modules & contracts

A **module** is the unit of organization. It owns its data, business logic, routes, permissions, and tests. A **contract** is the typed surface a module exposes to the rest of the app.

## `defineModule`

```ts
import { defineModule } from '@iguir/core/module/define'

export const postsModule = defineModule({
    name: 'posts',                          // lowercase, snake_case
    imports: [usersContract],               // other modules' contracts
    provides: postsContract,                // what this module exposes
    implementation: ({ services }) => ({    // required when `provides` is set
        list: async () => [...],
        findById: async ({ id }) => services.users.findById({ id }),
    }),
    acl: postsAcl,                          // see ACL guide
    events: postsEvents,                    // see Events guide
    routes: { handler: apiRoutes, prefix: '/api/posts' },
    pages: { manifest: pages, prefix: '/blog' },
    subscriptions: { 'user.created': onUserCreated },
    globalMiddleware: [auditMiddleware],    // runs before aclContext
    onBoot: async ({ logger, bus, services }) => { ... },
    onShutdown: async () => { ... },
})
```

Every field is validated at module-load time. Typos throw with a `[module:<name>]` tag.

## `defineContract`

A contract is a frozen description of public methods, with Zod schemas for input and output:

```ts
import { z } from 'zod'
import { defineContract } from '@iguir/core/module/contract'

export const postsContract = defineContract('posts', {
    list: {
        input: z.void(),
        output: z.array(PostSchema),
    },
    findById: {
        input: z.object({ id: z.string() }),
        output: PostSchema.nullable(),
    },
})
```

The contract is the only thing other modules import. When another module declares `imports: [postsContract]` and reaches into `services.posts.findById(...)`, the call is fully typed and runs against this module's `implementation`.

In v1 (monolith) the implementation is called directly. In v1.1+ the same contract drives an HTTP RPC client/server, so modules can be extracted without changing call sites.

## Cross-module-import lint rule

The most important rule in the framework:

> **Cross-module imports must go only through `*.contract.ts`.**

Biome enforces this. The scaffolded `biome.json` ships with:

```json
{
    "linter": {
        "rules": {
            "style": {
                "noRestrictedImports": {
                    "level": "error",
                    "options": {
                        "paths": {
                            "../*/!(*.contract).ts": "Cross-module imports must go through *.contract.ts.",
                            "../*/!(*.contract)/**": "Cross-module imports must go through *.contract.ts."
                        }
                    }
                }
            }
        }
    }
}
```

Without this rule, the microservice extraction story dies within three months. Don't disable it.

## Module shape archetypes

The example app uses one of each:

| Archetype | Example | Has |
|---|---|---|
| Full module | `posts` | pages + routes + contract + ACL + services + events |
| Contract-only consumer | `comments` | imports posts + users, renders as island in another page |
| Webhook + emitter | `billing` | public webhooks + private API + emits domain events |
| Pure subscriber | `email` | no routes, no pages — subscribes to events |
| Pages-only | `admin` | UI only, gated by one strict permission |

## `imports` + `provides` semantics

- A module can only reference other modules' contracts, not their internals.
- `imports` must be unique; a module can't import itself.
- `provides`'s contract name must equal the module name.
- Implementation factories run in **topological order** at boot — when your factory runs, every contract you import is already built.
- Cyclic imports throw a `[modules] cycle detected` error at bootstrap. Break the cycle by extracting a shared module both can import.

## Lifecycle

```ts
onBoot: async ({ logger, services, bus }) => {
    // Run after all implementations resolve, before serving requests.
    // Use for: warming caches, scheduling cron, opening connections.
},
onShutdown: async () => {
    // Reverse-topological order on SIGTERM/SIGINT.
    // Use for: closing pools, draining queues. Errors are logged, not thrown.
},
```

If `onBoot` throws, bootstrap rolls back every module that already booted by calling their `onShutdown`. Then it rethrows so the process exits non-zero.

→ Next: [Routing & validation](./routing).
