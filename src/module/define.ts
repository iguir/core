import type { ModuleContract } from './contract'
import type { ModuleSpec } from './types'

const MODULE_NAME_RE = /^[a-z][a-z0-9_]*$/
const EVENT_NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

/**
 * Declare a module. The returned value is the same spec, frozen, ready to be
 * passed to `defineConfig({ modules: [...] })`.
 *
 *   export const postsModule = defineModule({
 *     name: 'posts',
 *     imports: [usersContract],
 *     provides: postsContract,
 *     acl: postsAcl,
 *     events: postsEvents,
 *     routes: { handler: apiRoutes, prefix: '/api/posts' },
 *     pages: { dir: './pages', prefix: '/posts' },
 *     subscriptions: { 'user.created': onUserCreated },
 *     onBoot: async (ctx) => { ... },
 *     onShutdown: async () => { ... },
 *   })
 *
 * Validation happens at module-load time so misconfiguration surfaces before
 * the first request, not after deploy.
 */
export function defineModule<
    const TName extends string,
    const TImports extends readonly ModuleContract[],
    const TProvides extends ModuleContract | undefined = undefined,
>(
    spec: ModuleSpec<TName, TImports, TProvides>,
): ModuleSpec<TName, TImports, TProvides> {
    validate(spec)
    return Object.freeze({ ...spec }) as ModuleSpec<TName, TImports, TProvides>
}

function validate(spec: ModuleSpec): void {
    const { name } = spec

    if (!name || typeof name !== 'string') {
        throw new Error('[module] defineModule: `name` is required')
    }
    if (!MODULE_NAME_RE.test(name)) {
        throw new Error(
            `[module] name "${name}" is invalid. ` +
                'Use lowercase letters, digits, and underscores; must start with a letter.',
        )
    }

    const tag = `[module:${name}]`

    if (spec.imports !== undefined) {
        if (!Array.isArray(spec.imports)) {
            throw new Error(`${tag} imports must be an array of contracts`)
        }
        const seen = new Set<string>()
        for (const imp of spec.imports) {
            if (!isContract(imp)) {
                throw new Error(
                    `${tag} imports[*] must be the result of defineContract(). ` +
                        'Cross-module imports must go through *.contract.ts files.',
                )
            }
            if (imp.name === name) {
                throw new Error(`${tag} cannot import its own contract`)
            }
            if (seen.has(imp.name)) {
                throw new Error(`${tag} duplicate import "${imp.name}"`)
            }
            seen.add(imp.name)
        }
    }

    if (spec.provides !== undefined) {
        if (!isContract(spec.provides)) {
            throw new Error(`${tag} provides must be the result of defineContract()`)
        }
        if (spec.provides.name !== name) {
            throw new Error(
                `${tag} provides contract name "${spec.provides.name}" must match ` +
                    `module name "${name}"`,
            )
        }
    }

    if (spec.acl !== undefined && spec.acl.module !== name) {
        throw new Error(
            `${tag} acl.module is "${spec.acl.module}" but the module is "${name}". ` +
                'A module can only own permissions in its own namespace.',
        )
    }

    if (spec.routes !== undefined) {
        if (!spec.routes.handler) {
            throw new Error(`${tag} routes.handler is required`)
        }
        if (
            spec.routes.prefix !== undefined &&
            !spec.routes.prefix.startsWith('/')
        ) {
            throw new Error(
                `${tag} routes.prefix "${spec.routes.prefix}" must start with "/"`,
            )
        }
    }
    if (spec.pages !== undefined) {
        if (!spec.pages.dir || typeof spec.pages.dir !== 'string') {
            throw new Error(`${tag} pages.dir is required`)
        }
        if (
            spec.pages.prefix !== undefined &&
            !spec.pages.prefix.startsWith('/')
        ) {
            throw new Error(
                `${tag} pages.prefix "${spec.pages.prefix}" must start with "/"`,
            )
        }
    }

    if (spec.subscriptions !== undefined) {
        for (const [event, handler] of Object.entries(spec.subscriptions)) {
            if (!EVENT_NAME_RE.test(event)) {
                throw new Error(
                    `${tag} subscription event "${event}" has invalid format. ` +
                        'Expected "module.action[.modifier]" — lowercase, dot-separated.',
                )
            }
            if (typeof handler !== 'function') {
                throw new Error(
                    `${tag} subscription "${event}" handler must be a function`,
                )
            }
        }
    }

    if (spec.onBoot !== undefined && typeof spec.onBoot !== 'function') {
        throw new Error(`${tag} onBoot must be a function`)
    }
    if (spec.onShutdown !== undefined && typeof spec.onShutdown !== 'function') {
        throw new Error(`${tag} onShutdown must be a function`)
    }
}

function isContract(value: unknown): value is ModuleContract {
    return (
        !!value &&
        typeof value === 'object' &&
        typeof (value as { name?: unknown }).name === 'string' &&
        typeof (value as { methods?: unknown }).methods === 'object'
    )
}
