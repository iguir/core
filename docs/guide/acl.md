# ACL & permissions

The framework ships a three-layer authorization model:

1. **Roles** — declared once for the app (`admin`, `editor`, `viewer`, …).
2. **Module ACL** — each module owns permissions in its namespace (`posts.list`, `posts.update`).
3. **User overrides** — per-user grants and denies.

## `defineRoles`

```ts
import { defineRoles } from '@iguir/core/acl/roles'

export const roles = defineRoles({
    admin: { description: 'Full access', system: true },
    editor: { description: 'Can create + edit' },
    viewer: { description: 'Read-only' },
    customer: { description: 'Default for new sign-ups' },
})
```

System roles cannot be deleted from admin UIs (the flag is informational; it's up to your code to enforce it). Names must be lowercase identifiers.

## `defineAcl`

```ts
import { defineAcl } from '@iguir/core/acl/define'

export const postsAcl = defineAcl({
    module: 'posts',
    permissions: ['posts.list', 'posts.create', 'posts.update', 'posts.delete'] as const,
    defaults: {
        admin: ['*'],                            // wildcard: every permission in this module
        editor: ['posts.list', 'posts.create', 'posts.update'],
        viewer: ['posts.list'],
    },
    modes: {
        'posts.delete': 'strict',                // per-permission enforcement mode
    },
    defaultMode: 'flexible',                     // fallback for permissions without an explicit mode
})
```

Permission names must follow `module.action[.modifier]` (e.g. `posts.update.any`). The namespace must match the module name — `defineAcl` rejects `users.read` declared from a module named `posts`.

## Enforcement modes

| Mode | Behavior |
|---|---|
| `flexible` (default) | Role grants + user `permissionGrants` minus user `permissionDenies`. |
| `strict` | Only role grants count. User grants ignored. User denies still apply. |

Use `strict` for sensitive operations (`posts.delete`, `users.manage`, billing).

## Resolution algorithm

For every `can('posts.update')` call:

1. Unknown permission → `false` (fail closed).
2. Explicit deny on subject → `false` (always wins, even over admin).
3. Any of subject's roles grants the permission → `true`.
4. Mode is `flexible` AND subject has explicit grant → `true`.
5. Else → `false`.

## Per-route enforcement

Route options drive enforcement:

```ts
r.get('/', { auth: true, permission: 'posts.list' }, handler)
r.delete('/:id', {
    auth: true,
    permission: 'posts.delete',
    condition: async (c) => isOwner(c),         // resource-level check after permission
}, handler)
```

Without `auth` / `permission`, the route is public. Authenticated users without the required permission get a 403:

```json
{
    "error": {
        "code": "forbidden",
        "message": "You do not have permission to perform this action.",
        "status": 403,
        "details": { "permission": "posts.delete" }
    }
}
```

## In-code checks

Inside any handler, `c.var.can` is a typed checker:

```ts
c.var.can('posts.update')                       // boolean
c.var.can.all('posts.update', 'posts.update.any')
c.var.can.any('posts.publish', 'posts.publish.draft')
```

`c.var.can` is always present — even for anonymous requests it's `() => false`.

## User shape

```ts
interface AclUser {
    id?: string
    roles: readonly string[]
    permissionGrants?: readonly string[]
    permissionDenies?: readonly string[]
}
```

Auth middleware (yours — the framework doesn't ship one) populates `c.var.user`. Install it as a module's `globalMiddleware` so it runs **before** `aclContext`:

```ts
defineModule({
    name: 'auth',
    globalMiddleware: [yourSessionMiddleware],
    // ...
})
```

`aclContext` then reads `c.var.user` and builds the per-request `can()` checker against the resolved subject.

## Inspect

```sh
bunx iguir acl                                   # full table
bunx iguir acl --role editor                     # what does editor have?
bunx iguir acl --permission posts.delete         # who has posts.delete?
bunx iguir acl --json                            # machine-readable
```

→ Next: [Events](./events).
