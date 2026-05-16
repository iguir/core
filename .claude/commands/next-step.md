---
description: Print the next file to implement per the @iguir/core build order, and a 1-line cue for what it must do.
---

You are working on `@iguir/core`. Consult `CLAUDE.md` (build order) and `src/` to find the **first** file from the list below that is empty (0 lines) or missing. Print:

1. The file path.
2. The build-order step it belongs to.
3. A 1-sentence reminder of its responsibility.
4. Any sibling files that should land in the same commit (e.g. `define.ts` + `contract.ts`).

Order:

1. `src/types.ts` — shared public types (mostly stable; check).
2. `src/module/types.ts` — module shape types.
3. `src/module/define.ts` — `defineModule()` factory.
4. `src/module/contract.ts` — `defineContract()` factory.
5. `src/module/registry.ts` — `ModuleRegistry` with dependency resolution.
6. `src/bootstrap/resolve.ts` — imports → providers wiring.
7. `src/bootstrap/mount.ts` — mount routes, ACL, events, JSX renderer.
8. `src/bootstrap/lifecycle.ts` — `onBoot` / `onShutdown` orchestration.
9. `src/bootstrap/index.ts` — public `bootstrap()` entry.
10. `src/server.ts` — `Bun.serve` wrapper (currently a stub — verify it covers graceful shutdown).
11. `src/routing/code.ts` — `defineRoutes()` + `r` builder.
12. `src/validation/zod.ts` — Zod middleware + error formatter.
13. `src/errors/index.ts`, `src/errors/handler.ts`.
14. `src/logger/pino.ts`, `src/logger/middleware.ts`.
15. `src/events/bus.ts`, `src/events/memory.ts`, `src/events/define.ts`.
16. `src/validation/env.ts`, `src/config.ts` (extend), `src/context.ts`, `src/routing/openapi.ts`.
17. `src/jsx/*`, `src/routing/file.ts`.

Do NOT implement the file. Just point to it and remind me of the contract.
