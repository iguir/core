# Auth

`@iguir/core/auth` is a first-party module: cookie-session auth, password hashing via `Bun.password`, user + session stores you can replace.

## Set it up

```ts
// src/app/auth.ts
import {
    createAuthModule,
    DrizzleUserStore,
    DrizzleSessionStore,
} from '@iguir/core/auth'
import { db } from './db'

export const auth = createAuthModule({
    userStore: new DrizzleUserStore({ drizzle: db.drizzle }),
    sessionStore: new DrizzleSessionStore({ drizzle: db.drizzle }),
    cookieSecure: process.env.NODE_ENV === 'production',
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    prefix: '/auth',
})
```

Add it to your `defineConfig({ modules: [auth, ...] })` like any other module.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/auth/register` | `{ email, password, roles? }` | 201 + `PublicUser` + session cookie |
| `POST` | `/auth/login` | `{ email, password }` | 200 + `PublicUser` + session cookie |
| `POST` | `/auth/logout` | — | 204; invalidates session |
| `GET` | `/auth/me` | — | 200 + `PublicUser` (or 401) |

All session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

## Contract

Other modules can call the auth contract directly:

```ts
import { authContract } from '@iguir/core/auth'

defineModule({
    name: 'billing',
    imports: [authContract],
    implementation: ({ services }) => ({
        chargeUser: async ({ userId }) => {
            const user = await services.auth.findUserById({ id: userId })
            ...
        },
    }),
})
```

Contract methods: `findUserById`, `findUserByEmail`, `registerUser`, `verifyPassword`. Each is Zod-validated end-to-end.

## Events

`createAuthModule` publishes:

- `auth.user.registered` — payload: `PublicUser`
- `auth.user.logged_in` — payload: `{ userId, sessionId }`
- `auth.user.logged_out` — payload: `{ userId, sessionId }`

Subscribe from any module — send welcome emails, write to an audit log, kick off a Stripe customer creation flow.

## Stores

`UserStore` / `SessionStore` interfaces are exported. Built-in implementations:

| Class | Use case |
|---|---|
| `MemoryUserStore` | Tests, single-process dev only — state vanishes on restart |
| `MemorySessionStore` | Same |
| `DrizzleUserStore` | Production. Works with the Drizzle schema in `@iguir/core/db/schema/auth`. |
| `DrizzleSessionStore` | Same |

Custom stores are simple to write — implement the interfaces and pass to `createAuthModule`.

## Session middleware

`createSessionMiddleware` runs **before** `aclContext` (as a module `globalMiddleware`) so the user is set on `c.var.user` before any permission check.

```ts
c.var.user                                       // AclUser | undefined
c.var.can('posts.update')                        // typed checker for the user above
```

## ACL

The auth module declares its own permissions:

| Permission | Mode | Default |
|---|---|---|
| `auth.users.list` | `strict` | `admin` |
| `auth.users.manage` | `strict` | `admin` |

Strict mode means role grants only — per-user grants don't apply. No way to elevate yourself to admin via grants.

## Replacing the auth module

The built-in module is for the common case. If you need OAuth, JWT, mTLS — write your own module that:

1. Provides a similar contract (or your own).
2. Includes a `globalMiddleware` that populates `c.var.user`.
3. Declares whatever events your app wants to subscribe to.

The framework doesn't care; it only requires `c.var.user` shape from the middleware path.

→ Next: [Database (Drizzle)](./db).
