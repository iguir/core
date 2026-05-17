# CLI (iguir)

The `iguir` binary is installed when you `bun add @iguir/core`. Run with `bunx iguir <command>` from inside a project.

```sh
bunx iguir --help
```

## Commands

### `iguir new <target>`

Scaffolds a fresh project — same as `bunx create-iguir <target>`.

```sh
bunx iguir new my-app
bunx iguir new my-app --core-version "^0.1.0" --force
```

### `iguir dev`

Runs `bun --hot src/main.ts`. When `vite.config.ts` is present, also spawns `bunx vite` in parallel so JSX page changes hot-reload.

```sh
bunx iguir dev
bunx iguir dev --no-vite                         # skip vite even if config is present
bunx iguir dev --entry src/alt.ts                # override server entrypoint
```

### `iguir start`

Production run, no `--hot`. Vite is not spawned (production assets must be pre-built).

```sh
bunx iguir start
```

### `iguir build`

Builds the server bundle with `bun build`. When `vite.config.ts` is present, runs `vite build` first to produce client assets.

```sh
bunx iguir build
bunx iguir build --minify --outdir build
```

### `iguir routes`

Lists every declared route across all modules with the permission gating them.

```sh
$ bunx iguir routes
METHOD  PATH                MODULE  PERMISSION
GET     🔒 /api/posts       posts   posts.list
POST    🔒 /api/posts       posts   posts.create
DELETE  🔒 /api/posts/:id   posts   posts.delete
GET        /api/posts/health posts  —
```

`--json` for machine output. `--config <path>` to point at a non-default config.

### `iguir acl`

Inspect roles, permissions, and grants.

```sh
bunx iguir acl                                   # full table
bunx iguir acl --role editor                     # drill into one role
bunx iguir acl --permission posts.delete         # who has this permission?
bunx iguir acl --json
```

### `iguir openapi`

Generates an OpenAPI 3.1 document from your declared routes.

```sh
bunx iguir openapi                               # → stdout
bunx iguir openapi --out openapi.json
bunx iguir openapi --title "My API" --version 2.0.0 --server https://api.example.com
```

The doc includes `bearerAuth` for routes with `auth: true`, an `x-permission` extension carrying the permission name, and 401/403/422 responses where applicable.

### `iguir generate module <name>`

Scaffolds a new module under `src/modules/<name>/`.

```sh
bunx iguir generate module billing
bunx iguir generate module billing --with routes,acl,events,services,tests --force
```

Available features: `routes`, `contract`, `acl`, `events`, `services`, `tests`. Defaults to `routes,contract,acl,services,tests`.

### `iguir test [...args]`

Passthrough to `bun test`, runs in your project's cwd. Every argument after `test` is forwarded verbatim.

```sh
bunx iguir test
bunx iguir test src/modules/posts/tests --watch
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation / user error (bad command, invalid name, missing config) |
| Other | Bubbled from the spawned process (`bun`, `vite`, `bun test`) |

## Configuration discovery

Every command that needs `app.config.ts` walks upward from the current working directory until it finds one. Override with `--config <path>`. Apps may export the config from `app.config.ts`, `app.config.js`, or `app.config.mjs` — first match wins.

## Custom config import patterns

The framework dynamic-imports your `app.config.ts`. The file must `export default defineConfig({...})`. Do **not** call `bootstrap()` at module-load time inside `app.config.ts` — that breaks introspection commands like `routes` / `acl` / `openapi`.

→ Next: [Testing](./testing).
