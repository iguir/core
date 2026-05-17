# Routing & validation

APIs are declared in code with `defineRoutes(({ r }) => ...)`. Pages are declared on the filesystem (see [JSX, pages & islands](./jsx)).

## `defineRoutes` + the `r` builder

```ts
import { z } from 'zod'
import { defineRoutes } from '@iguir/core/routing/code'

const PostBody = z.object({ title: z.string().min(1), body: z.string() })

export const apiRoutes = defineRoutes(({ r, services }) => {
    r.get('/health', {}, (c) => c.json({ ok: true }))

    r.get('/', { auth: true, permission: 'posts.list' }, async (c) =>
        c.json(await services.posts.list()),
    )

    r.post('/',
        { auth: true, permission: 'posts.create', body: PostBody },
        async (c) => {
            const data = c.req.valid('json')        // typed from PostBody
            const post = await services.posts.create(data)
            return c.json(post, 201)
        },
    )

    r.delete('/:id',
        {
            auth: true,
            permission: 'posts.delete',
            param: z.object({ id: z.string() }),
            condition: async (c) => {
                const id = c.req.valid('param').id
                const post = await services.posts.findById({ id })
                return post?.authorId === c.var.user?.id
            },
        },
        async (c) => {
            await services.posts.delete(c.req.valid('param').id)
            return c.body(null, 204)
        },
    )
})
```

## Route options

Every `r.<verb>(path, options, handler)` accepts the same option bag:

| Option | Type | Effect |
|---|---|---|
| `auth` | `boolean` | Require an authenticated user; 401 otherwise. |
| `permission` | `string` | ACL permission to check; 403 if denied. Implies `auth: true`. |
| `condition` | `(c) => boolean \| Promise<boolean>` | Resource-level guard, runs after permission. Returns false → 403. |
| `body` | `ZodType` | Validates JSON body. |
| `query` | `ZodType` | Validates query string. |
| `param` | `ZodType` | Validates path params. |
| `header` | `ZodType` | Validates request headers. |

## Typed `c.req.valid()`

`c.req.valid(target)` is narrowed against your route's options. Reading a target you didn't declare is a compile-time error:

```ts
r.post('/', { body: PostBody }, (c) => {
    const data = c.req.valid('json')        // ✅ typed as z.infer<typeof PostBody>
    c.req.valid('query')                    // ❌ no query schema — type error
})
```

No casts. No `as never`. No `as { … }`. The wrap-and-cast pair both used to be required in early drafts; it's gone for good.

## Validation failures

Any Zod failure throws `ValidationError(422)` automatically. The global error handler renders:

```json
{
    "error": {
        "code": "validation_failed",
        "message": "Invalid body",
        "status": 422,
        "details": [
            { "target": "json", "path": ["title"], "code": "too_small", "message": "..." }
        ]
    }
}
```

## Error model

Throw `AppError` (or a subclass) from any handler. The global handler renders the JSON consistently:

```ts
import { NotFoundError, ConflictError, RedirectError } from '@iguir/core/errors'

throw new NotFoundError(`post "${id}" not found`)
throw new ConflictError('email already in use', { email })
throw new RedirectError('/login')          // 302 + Location header
```

| Class | Status | Code |
|---|---|---|
| `BadRequestError` | 400 | `bad_request` |
| `UnauthorizedError` | 401 | `unauthorized` |
| `ForbiddenError` | 403 | `forbidden` |
| `NotFoundError` | 404 | `not_found` |
| `ConflictError` | 409 | `conflict` |
| `ValidationError` | 422 | `validation_failed` |
| `RedirectError` | 302/303/307/308 | `redirect` |
| `HttpError(status, msg, opts)` | any | `http.<status>` |
| `AppError({ code, status, message, details, cause })` | any | your code |

Any non-`AppError` exception becomes a 500 with the message hidden in production (set `NODE_ENV=production`).

## Escape hatch

If you need raw Hono at any point:

```ts
const honoSubApp = apiRoutes.raw()       // R.raw() — bare Hono instance
```

→ Next: [ACL & permissions](./acl).
