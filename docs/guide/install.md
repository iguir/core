# Install

## Requirements

- **Bun** ≥ 1.3. The framework uses `Bun.serve`, `Bun.password`, `Bun.sql`, and `bun:sqlite` directly.
- That's it. No Node.js. No global TypeScript install (Bun runs TS natively).

## Scaffold a new app

The fastest path is the official scaffolder:

```sh
bunx create-iguir my-app
cd my-app
bun install
bun dev
```

This creates a working API with auth, a sample `posts` module, SQLite via Drizzle, and a Vite config wired up for JSX pages and islands. Hit `http://localhost:3000/api/posts/health` to confirm it's alive.

## Add to an existing project

```sh
bun add @iguir/core hono zod drizzle-orm pino
```

The framework is exported in submodule form — pull in what you need:

```ts
import { bootstrap } from '@iguir/core/bootstrap'
import serve from '@iguir/core/server'
import { defineConfig } from '@iguir/core/config'
import { defineRoles } from '@iguir/core/acl/roles'
import { defineModule } from '@iguir/core/module/define'
```

## Project layout

A scaffolded app looks like this:

```
my-app/
├── app.config.ts                # defineConfig({ roles, modules, server })
├── vite.config.ts               # @iguir/core/vite-plugin
├── src/
│   ├── main.ts                  # bootstrap + serve
│   ├── app/                     # app-wide singletons (not a module)
│   │   ├── acl.ts               # defineRoles({...})
│   │   ├── env.ts               # validated env via defineEnv
│   │   ├── db.ts                # createDb + auth schema
│   │   └── auth.ts              # createAuthModule(...)
│   └── modules/
│       └── posts/
│           ├── posts.module.ts
│           ├── posts.contract.ts
│           ├── posts.acl.ts
│           ├── routes/api.ts
│           ├── services/
│           └── tests/
└── tests/                       # cross-module end-to-end tests
```

The `iguir` CLI command is installed as a bin. From your project:

```sh
bunx iguir --help
```

## Installing the CLI globally

If you want `iguir` available on `$PATH` system-wide (no `bunx` prefix), run from inside the framework checkout:

```sh
bun run cli:link            # installs the iguir + create-iguir binaries globally
bun run cli:unlink          # remove them
```

After `cli:link`:

```sh
$ which iguir
/Users/me/.bun/bin/iguir

$ iguir --version
0.0.1
```

The `cli:link` script lives inside `@iguir/core`'s `package.json` and is the recommended local-dev path because the binary picks up changes to the source files immediately — no rebuild needed.

### Standalone binary (optional)

For distribution to machines that don't have Bun, compile to a self-contained executable:

```sh
bun run cli:compile         # writes ./bin/iguir and ./bin/create-iguir
```

The binaries embed the Bun runtime (~60 MB each) and run on any compatible OS without `bun install`. On first launch on macOS you may need to allow them via System Settings → Privacy & Security.

→ Next: [Quick start](./quick-start).
