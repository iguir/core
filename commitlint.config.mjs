export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        // ── @iguir/core source tree ─────────────────────────────────────────
        'core',          // framework entrypoint, public surface, cross-cutting
        'acl',           // src/acl/* — roles, permissions, resolver, middleware
        'module',        // src/module/* — defineModule, defineContract, registry
        'bootstrap',     // src/bootstrap/* — wiring, mount, lifecycle
        'routing',       // src/routing/* — defineRoutes, file routes, openapi
        'validation',    // src/validation/* — zod middleware, defineEnv
        'errors',        // src/errors/* — AppError, error handler
        'logger',        // src/logger/* — pino + middleware
        'events',        // src/events/* — bus, in-memory, defineEvents
        'jsx',           // src/jsx/* — renderer, layout, islands, meta
        'config',        // src/config.ts — defineConfig
        'server',        // src/server.ts — Bun.serve wrapper, graceful shutdown
        'context',       // src/context.ts — Hono Context augmentations
        'types',         // src/types.ts and other type-only changes

        // ── sibling packages (added as they land) ─────────────────────────
        'testing',       // @iguir/testing — testApp() helper
        'cli',           // @iguir/cli — `app` binary
        'vite-plugin',   // @iguir/vite-plugin — file routes, JSX, islands
        'auth',          // @iguir/auth — first-party auth module
        'db',            // @iguir/db — Drizzle integration + auth stores
        'create-app',    // create-app scaffolder

        // ── repo-level / meta ─────────────────────────────────────────────
        'deps',          // dependency bumps
        'release',       // release / changeset commits
        'docs',          // VitePress site or top-level docs
        'examples',      // examples/* apps
        'tests',         // cross-cutting test infrastructure
        'tooling',       // biome, tsconfig, husky, CI, scripts
        // add more as the framework grows
      ],
    ],
    'scope-empty': [2, 'never'],          // force a scope
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],          // disable, breaks long URLs in bodies
  },
};