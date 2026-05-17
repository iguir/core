# Testing

`testApp()` boots the whole stack in-memory and gives you a typed harness. Use it everywhere — unit tests, integration tests, end-to-end flows. No HTTP server needed; Hono's `app.request()` does the dispatching.

## Quick start

```ts
import { describe, expect, test } from 'bun:test'
import { testApp } from '@iguir/core/testing'
import { roles } from '../src/app/acl'
import { auth } from '../src/app/auth'
import { postsModule } from '../src/modules/posts/posts.module'

test('public health is public', async () => {
    const app = await testApp({ roles, modules: [auth, postsModule] })
    const { status, body } = await app.json<{ ok: boolean }>('/api/posts/health')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    await app.shutdown()
})
```

## Options

```ts
testApp({
    roles,                                       // required
    modules,                                     // required — same shape as defineConfig
    user: { id: 'u1', roles: ['editor'] },       // baseline authenticated user for every request
    logger,                                      // optional — silent by default
    eventBus,                                    // optional — defaults to InMemoryEventBus
})
```

## Returned harness

| Method | Use |
|---|---|
| `app.request(path, init?)` | Hono `request()` — returns `Response`. Add `init.user` to override per-request. |
| `app.json<T>(path, init?)` | Convenience wrapper — returns `{ status, headers, body }` with JSON-parsed body. |
| `app.as(user \| null)` | Returns a new harness view bound to a different baseline user. |
| `app.service(contract)` | Typed direct access to a module's implementation — call from unit tests. |
| `app.events()` | All bus events published since `testApp()` (or last `clearEvents()`). |
| `app.clearEvents()` | Drop the captured-events buffer. |
| `app.shutdown()` | Runs `onShutdown` for every booted module. |
| `app.app`, `app.bus`, `app.services`, `app.acl`, `app.logger` | Direct access to underlying layers. |

## Per-request user overrides

```ts
const app = await testApp({
    roles, modules: [auth, postsModule],
    user: { id: 'u1', roles: ['viewer'] },       // baseline
})

await app.request('/api/posts')                  // runs as viewer
await app.request('/api/posts', { user: null }) // forces anonymous → 401
await app.as({ id: 'u2', roles: ['editor'] })   // new view, no re-bootstrap
    .request('/api/posts', { method: 'POST', ... })
```

## Direct service calls

For unit-level testing of a module's contract methods without going through HTTP:

```ts
const app = await testApp({ roles, modules: [auth] })
const auth = app.service(authContract)
const user = await auth.registerUser({
    email: 'a@b.c', password: 'longenoughpw', roles: ['customer'],
})
expect(user.email).toBe('a@b.c')
```

## Asserting on events

```ts
const app = await testApp({ roles, modules: [auth] })
await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'x@y.z', password: 'longenoughpw' }),
})
const events = app.events()
expect(events.map((e) => e.name)).toContain('auth.user.registered')
```

## Test conventions

- **Tests live in a per-module `tests/` subfolder.** `src/modules/posts/tests/posts.test.ts`, not next to the source file. Cross-module end-to-end tests live in the repo-root `tests/`.
- **Run with `bun test`.** No jest/vitest config; Bun discovers `*.test.ts` / `*.test.tsx`.
- **Avoid mocking the framework.** Use `testApp()` with in-memory stores instead.

## Common patterns

### Auth round-trip

```ts
const app = await testApp({ roles, modules: [auth] })
const register = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'longenoughpw' }),
})
const cookie = register.headers.get('set-cookie')!.split(';')[0]
const me = await app.request('/auth/me', {
    user: null,
    headers: { cookie },
})
expect(me.status).toBe(200)
```

### Asserting validation errors

```ts
const { status, body } = await app.json<{ error: { code: string } }>('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '' }),
})
expect(status).toBe(422)
expect(body.error.code).toBe('validation_failed')
```

### Permission denial

```ts
const app = await testApp({
    roles, modules: [auth, postsModule],
    user: { roles: ['viewer'] },                 // viewer can't create
})
const res = await app.request('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Nope' }),
})
expect(res.status).toBe(403)
```

That's it. If you can't test something with `testApp()`, file an issue — the goal is one harness for everything.
