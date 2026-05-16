import type { AclSubject } from './types'
import type { AclRegistry } from './registry'

/**
 * Compute whether a subject is permitted to perform a permission.
 *
 * Algorithm:
 *   0. Unknown permission         → false (fail closed)
 *   1. Explicit deny on subject   → false (always wins)
 *   2. Any of subject's roles grants the permission → true
 *   3. Mode is 'flexible' AND subject has explicit grant → true
 *   4. Otherwise                  → false
 */
export function can(
    subject: AclSubject,
    permission: string,
    registry: AclRegistry,
): boolean {
    // 0. Fail closed on unknown permissions. Loud in dev, silent in production.
    if (!registry.permissionExists(permission)) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(
                `[acl] can() called with unknown permission "${permission}". ` +
                `Returning false. Did you forget to declare it in defineAcl?`,
            )
        }
        return false
    }

    // 1. Deny override always wins — even against admin, even in strict mode.
    if (subject.permissionDenies?.includes(permission)) {
        return false
    }

    // 2. Role-based grant.
    for (const role of subject.roles) {
        if (registry.hasPermission(role, permission)) {
            return true
        }
    }

    // 3. Per-user grant — only counts in flexible mode.
    const mode = registry.modeOf(permission) ?? 'flexible'
    if (mode === 'flexible' && subject.permissionGrants?.includes(permission)) {
        return true
    }

    // 4. No path to allow.
    return false
}

/**
 * A reusable checker callable. Created once per request by the middleware and
 * attached to `c.var.can`. All variants share the same subject + registry,
 * so they're allocation-free at call time.
 *
 *   c.var.can('posts.update')                          // single
 *   c.var.can.all('posts.read', 'posts.update')        // every one
 *   c.var.can.any('posts.update', 'posts.update.any')  // at least one
 */
export type Checker = ((permission: string) => boolean) & {
    all: (...permissions: string[]) => boolean
    any: (...permissions: string[]) => boolean
}

export function createChecker(
    subject: AclSubject,
    registry: AclRegistry,
): Checker {
    const check = (permission: string) => can(subject, permission, registry)
    const checker = check as Checker
    checker.all = (...perms) => perms.every((p) => can(subject, p, registry))
    checker.any = (...perms) => perms.some((p) => can(subject, p, registry))
    return checker
}

/** Anonymous checker for unauthenticated requests — always returns false. */
export function anonymousChecker(): Checker {
    const fn = (() => false) as unknown as Checker
    fn.all = () => false
    fn.any = () => false
    return fn
}