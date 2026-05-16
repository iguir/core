import type { ModuleContract } from '../module/contract'
import type { ModuleRegistry } from '../module/registry'
import type {
    Implementation,
    ImplementationFactory,
    ModuleLogger,
    ModuleSpec,
} from '../module/types'

/**
 * Frozen, query-ready map of contract name → runtime implementation.
 * Produced once by `resolveServices()` and read by routes, subscribers, and
 * other modules' `onBoot` hooks.
 */
export class ServiceRegistry {
    private readonly services: ReadonlyMap<string, Implementation<ModuleContract>>

    constructor(services: Map<string, Implementation<ModuleContract>>) {
        this.services = services
        Object.freeze(this)
    }

    /** Returns the implementation registered for a contract, or throws. */
    require<TContract extends ModuleContract>(
        contract: TContract,
    ): Implementation<TContract> {
        const impl = this.services.get(contract.name)
        if (!impl) {
            throw new Error(
                `[services] no implementation registered for contract "${contract.name}". ` +
                    'Did you forget to include the providing module in defineConfig({ modules })?',
            )
        }
        return impl as Implementation<TContract>
    }

    /** Returns the implementation or undefined — for optional consumers. */
    get<TContract extends ModuleContract>(
        contract: TContract,
    ): Implementation<TContract> | undefined {
        return this.services.get(contract.name) as
            | Implementation<TContract>
            | undefined
    }

    has(contractName: string): boolean {
        return this.services.has(contractName)
    }

    /**
     * Build a typed `services` map for a module's imports. Used by `mount.ts`
     * when wiring `defineRoutes(({ services }) => ...)` callbacks.
     */
    pickFor(
        imports: readonly ModuleContract[],
    ): Record<string, Implementation<ModuleContract>> {
        const picked: Record<string, Implementation<ModuleContract>> = {}
        for (const imp of imports) {
            const impl = this.services.get(imp.name)
            if (impl) picked[imp.name] = impl
        }
        return picked
    }
}

/** Hooks the resolver needs from the surrounding bootstrap. */
export interface ResolveServicesDeps {
    /** Root logger; per-module loggers are created via `logger.child({ module })`. */
    logger: ModuleLogger
}

/**
 * Run every module's `implementation` factory in dependency-first order.
 * Each factory sees the resolved services for its imports — never a dangling
 * promise, never a stub. Errors are wrapped with the offending module name so
 * stack traces are actionable.
 */
export async function resolveServices(
    registry: ModuleRegistry,
    deps: ResolveServicesDeps,
): Promise<ServiceRegistry> {
    const services = new Map<string, Implementation<ModuleContract>>()

    for (const m of registry.inBootOrder()) {
        const provides = m.provides as ModuleContract | undefined
        const factory = (m as { implementation?: unknown }).implementation as
            | ImplementationFactory<ModuleContract, readonly ModuleContract[]>
            | undefined

        if (!provides || !factory) continue

        const moduleLogger = deps.logger.child({ module: m.name })
        const imported = pickServices(m, services)

        let impl: Implementation<ModuleContract>
        try {
            impl = await factory({ logger: moduleLogger, services: imported })
        } catch (cause) {
            throw new Error(
                `[module:${m.name}] implementation factory threw during bootstrap: ${formatCause(cause)}`,
                { cause: cause instanceof Error ? cause : undefined },
            )
        }

        assertImplementationShape(m, provides, impl)
        services.set(provides.name, impl)
    }

    return new ServiceRegistry(services)
}

function pickServices(
    m: ModuleSpec,
    services: ReadonlyMap<string, Implementation<ModuleContract>>,
): Record<string, Implementation<ModuleContract>> {
    const picked: Record<string, Implementation<ModuleContract>> = {}
    for (const imp of m.imports ?? []) {
        const impl = services.get(imp.name)
        if (!impl) {
            // Topo sort guarantees this never fires; treat as an internal bug.
            throw new Error(
                `[module:${m.name}] internal: missing service for "${imp.name}" at resolve time`,
            )
        }
        picked[imp.name] = impl
    }
    return picked
}

function assertImplementationShape(
    m: ModuleSpec,
    provides: ModuleContract,
    impl: unknown,
): void {
    if (!impl || typeof impl !== 'object') {
        throw new Error(
            `[module:${m.name}] implementation factory must return an object of methods`,
        )
    }
    for (const methodName of Object.keys(provides.methods)) {
        const fn = (impl as Record<string, unknown>)[methodName]
        if (typeof fn !== 'function') {
            throw new Error(
                `[module:${m.name}] implementation is missing method "${methodName}" ` +
                    `declared in contract "${provides.name}". ` +
                    `Expected methods: ${Object.keys(provides.methods).join(', ')}`,
            )
        }
    }
}

function formatCause(cause: unknown): string {
    if (cause instanceof Error) return cause.message
    return String(cause)
}
