---
layout: home
hero:
    name: '@iguir/core'
    text: 'Meta-framework for Bun.'
    tagline: Build APIs and full-stack websites with Hono, Zod, Drizzle, and a great DX. Bun-only, explicit, scalable.
    actions:
        - theme: brand
          text: Get started
          link: /guide/quick-start
        - theme: alt
          text: Why this framework
          link: /#principles
features:
    - title: Built on Hono, never forked
      details: We add layers around Hono — we don't replace it. Drop down to raw Hono at any point.
    - title: One way to do common things
      details: Validation is Zod. ORM is Drizzle. Logger is Pino. JSX is hono/jsx. No "neutral on every choice" syndrome.
    - title: Modules with explicit contracts
      details: Every module declares its public surface as a typed contract. Cross-module imports are linted at the boundary.
    - title: Hybrid routing
      details: Code-routed APIs for refactor-safety. File-routed pages for intuition. Same module declares both.
    - title: Bake-in testing
      details: testApp() spins up the whole stack in-memory. No HTTP server needed.
    - title: Bun-native
      details: Bun.serve, bun:sqlite, Bun.sql, Bun.password — straight to the runtime. No Node compatibility shims.
---

## Principles {#principles}

These are non-negotiable. Push back on anything that violates them.

1. **Build on Hono, never fork it.** Pin a stable major. The framework adds layers; Hono stays untouched.
2. **Use Vite for build/dev, never reinvent the bundler.** Every framework that built its own bundler regretted it.
3. **One way to do common things.** Validation is Zod. ORM is Drizzle. Logger is Pino. JSX is `hono/jsx`. Don't be neutral on every choice.
4. **Modules are explicit, not implicit.** Register with `defineModule({...})`. No filesystem scanning for module discovery — auto-discovery looks magical until something doesn't load and you can't find why.
5. **Hybrid routing.** File-based for pages (intuitive). Code-based for APIs (explicit OpenAPI, refactor-safe). Same module can declare both.
6. **Testing is the API, not an add-on.** `testApp()` uses Hono's `app.request()` — no HTTP server needed. Baked in from day one.
7. **Escape hatches everywhere.** Anyone should be able to drop down to raw Hono at any layer. The moment they can't, they switch frameworks.
8. **No DI container.** TypeScript doesn't need one for HTTP servers. Pass dependencies via `c.var.x`, typed through module augmentation.
9. **Documentation ships with v1.0.** Not "we'll write docs after." (You're reading them.)

## Not for everyone

We're explicit about what we **don't** support:

- **Not Node.js.** Bun-only. Simpler runtime, faster, native TS.
- **Not a forked Hono.** The Blitz/Next mistake killed Blitz.
- **No filesystem auto-discovery of modules.** Magic discovery breaks at scale.
- **No custom bundler or dev server.** Meteor's death.
- **No real-time, queues, admin UI, or cron in v1.** Stay focused.

If any of that is a dealbreaker, pick a different tool — and that's fine.
