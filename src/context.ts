/**
 * Public type-augmentation hub for Hono's `Context`.
 *
 * Concrete augmentations live next to the middleware that sets each variable:
 *   - `c.var.can` / `c.var.user`        → src/acl/middleware.ts (AclVariables)
 *   - `c.var.logger` / `c.var.reqId`    → src/logger/middleware.ts (LoggerVariables)
 *
 * Re-exporting their types here gives downstream apps one canonical surface to
 * import — and a place to declare app-wide additions via module augmentation:
 *
 *   declare module '@iguir/core' {
 *     interface AppContextVariables {
 *       db: MyDrizzleClient
 *     }
 *   }
 */
import type { Context } from 'hono'
import type { AclVariables } from './acl/middleware'
import type { LoggerVariables } from './logger/middleware'

/**
 * Union of every variable the framework attaches to a request. Apps can extend
 * this through module augmentation to add their own (db handles, tenant info,
 * etc.) — Hono's `ContextVariableMap` is the wire underneath.
 */
export interface AppContextVariables extends AclVariables, LoggerVariables {}

/** A request-shaped Hono `Context` with framework variables wired in. */
export type AppContext = Context<{ Variables: AppContextVariables }>

// Re-export the per-feature variable interfaces so consumers can pin them
// individually when they want to (e.g. only the logger types).
export type { AclVariables } from './acl/middleware'
export type { LoggerVariables } from './logger/middleware'
