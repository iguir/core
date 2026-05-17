import type { ModuleContract } from './contract'
import type { ModuleSpec } from './types'

/**
 * Built once at bootstrap from the list of modules in the user's `app.config.ts`.
 *
 * Responsibilities:
 *   - Reject duplicate module names.
 *   - Index every contract by its provider so imports can be resolved later.
 *   - Verify every declared import is satisfied by some module's `provides`.
 *   - Reject cycles in the imports graph (topological sort).
 *   - Expose a stable boot order (dependencies first) for `onBoot` orchestration.
 *
 * The registry is frozen after construction — runtime lookups are O(1) and
 * allocation-free.
 */
export class ModuleRegistry {
    private readonly modulesByName = new Map<string, ModuleSpec>()
    /** contract name → name of the module that provides it */
    private readonly providers = new Map<string, string>()
    /** modules in topological order: dependencies before dependents */
    private readonly bootOrder: readonly ModuleSpec[]

    constructor(modules: readonly ModuleSpec[]) {
        if (!Array.isArray(modules)) {
            throw new TypeError('[modules] ModuleRegistry: `modules` must be an array')
        }

        // 1. Index by name; reject duplicates.
        for (const m of modules) {
            if (!m || typeof m !== 'object' || typeof m.name !== 'string') {
                throw new TypeError(
                    '[modules] every entry passed to ModuleRegistry must be the result of defineModule()',
                )
            }
            if (this.modulesByName.has(m.name)) {
                throw new Error(
                    `[modules] module "${m.name}" is registered more than once`,
                )
            }
            this.modulesByName.set(m.name, m)
        }

        // 2. Index providers; reject duplicate provides.
        for (const m of modules) {
            const provides = m.provides as ModuleContract | undefined
            if (!provides) continue
            const existing = this.providers.get(provides.name)
            if (existing) {
                throw new Error(
                    `[modules] contract "${provides.name}" is provided by ` +
                        `both "${existing}" and "${m.name}"`,
                )
            }
            this.providers.set(provides.name, m.name)
        }

        // 3. Verify every import is satisfied.
        for (const m of modules) {
            for (const imp of m.imports ?? []) {
                if (!this.providers.has(imp.name)) {
                    throw new Error(
                        `[module:${m.name}] imports contract "${imp.name}" but no ` +
                            'module provides it. Did you forget to add the providing ' +
                            'module to defineConfig({ modules: [...] })?',
                    )
                }
            }
        }

        // 4. Topo sort.
        this.bootOrder = topoSort(modules, this.providers)

        Object.freeze(this)
    }

    // ------------------------------------------------------------------
    // lookups
    // ------------------------------------------------------------------

    get(name: string): ModuleSpec | undefined {
        return this.modulesByName.get(name)
    }

    has(name: string): boolean {
        return this.modulesByName.has(name)
    }

    /** All modules in the order they were registered. */
    all(): readonly ModuleSpec[] {
        return [...this.modulesByName.values()]
    }

    /** Modules ordered such that every module appears after its imports. */
    inBootOrder(): readonly ModuleSpec[] {
        return this.bootOrder
    }

    /** Module that provides a given contract, or undefined if unknown. */
    providerOf(contractName: string): ModuleSpec | undefined {
        const name = this.providers.get(contractName)
        return name ? this.modulesByName.get(name) : undefined
    }

    allModuleNames(): readonly string[] {
        return [...this.modulesByName.keys()]
    }

    allContractNames(): readonly string[] {
        return [...this.providers.keys()]
    }
}

/**
 * Kahn's algorithm. Edges go from a module to each module it imports. We emit
 * dependency-first by removing nodes with no remaining outgoing edges.
 */
function topoSort(
    modules: readonly ModuleSpec[],
    providers: ReadonlyMap<string, string>,
): readonly ModuleSpec[] {
    /** module name → set of module names it depends on (still unresolved) */
    const remaining = new Map<string, Set<string>>()
    /** module name → set of module names that depend on it */
    const dependents = new Map<string, Set<string>>()

    for (const m of modules) {
        remaining.set(m.name, new Set())
        dependents.set(m.name, new Set())
    }

    for (const m of modules) {
        for (const imp of m.imports ?? []) {
            const providerName = providers.get(imp.name)
            if (!providerName || providerName === m.name) continue
            remaining.get(m.name)!.add(providerName)
            dependents.get(providerName)!.add(m.name)
        }
    }

    const queue: ModuleSpec[] = []
    const byName = new Map(modules.map((m) => [m.name, m] as const))

    // Seed with modules that have no dependencies; preserve registration order
    // so the boot order is deterministic.
    for (const m of modules) {
        if (remaining.get(m.name)!.size === 0) queue.push(m)
    }

    const sorted: ModuleSpec[] = []
    while (queue.length > 0) {
        const m = queue.shift()!
        sorted.push(m)
        for (const dep of dependents.get(m.name)!) {
            const set = remaining.get(dep)!
            set.delete(m.name)
            if (set.size === 0) queue.push(byName.get(dep)!)
        }
    }

    if (sorted.length !== modules.length) {
        const stuck = modules
            .map((m) => m.name)
            .filter((n) => !sorted.find((s) => s.name === n))
        throw new Error(
            `[modules] cycle detected in module imports involving: ${stuck.join(', ')}. ` +
                'Modules cannot have circular dependencies — split shared logic into a ' +
                'third module that both can import.',
        )
    }

    return sorted
}
