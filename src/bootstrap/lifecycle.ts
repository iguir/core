import type { ModuleRegistry } from '../module/registry'
import type { ModuleContract } from '../module/contract'
import type { ModuleLogger, ModuleSpec } from '../module/types'
import type { ServiceRegistry } from './resolve'

/** Deps the lifecycle controller needs to run module hooks. */
export interface LifecycleDeps {
    registry: ModuleRegistry
    services: ServiceRegistry
    logger: ModuleLogger
}

/** Result of a shutdown pass. Errors are collected, never thrown — shutdown must finish. */
export interface ShutdownReport {
    completed: readonly string[]
    failed: readonly { module: string; error: Error }[]
}

/**
 * Lifecycle controller. Owns the wiring of `onBoot` / `onShutdown` hooks and
 * the OS signal handlers that drive graceful shutdown. Exposed so the public
 * `bootstrap()` can hand it off to `serve()` for signal installation, and so
 * tests can drive boot/shutdown by hand without spawning a server.
 */
export class Lifecycle {
    private bootedModules: string[] = []
    private isShuttingDown = false
    private signalDisposers: Array<() => void> = []

    constructor(private readonly deps: LifecycleDeps) {}

    /**
     * Run `onBoot` for every module in dependency-first order. If any hook
     * throws, the partial-boot state is rolled back by running `onShutdown`
     * for everything that booted successfully — then the original error is
     * re-thrown so the caller can decide to crash.
     */
    async boot(): Promise<void> {
        const { registry, services, logger } = this.deps

        for (const m of registry.inBootOrder()) {
            const moduleLogger = logger.child({ module: m.name })
            try {
                if (m.onBoot) {
                    await m.onBoot({
                        logger: moduleLogger,
                        services: services.pickFor(
                            (m.imports as readonly ModuleContract[] | undefined) ?? [],
                        ),
                    })
                }
                // Track every module we got past — even hookless ones — so that
                // their `onShutdown` (and any implementation-allocated resources)
                // get the chance to clean up on normal shutdown.
                this.bootedModules.push(m.name)
            } catch (cause) {
                logger.error(
                    { module: m.name, err: cause },
                    `[module:${m.name}] onBoot failed; rolling back booted modules`,
                )
                await this.shutdown()
                throw wrapError(
                    `[module:${m.name}] onBoot threw during bootstrap`,
                    cause,
                )
            }
        }
    }

    /**
     * Run `onShutdown` for every booted module in reverse dependency order.
     * Idempotent: calling twice is a no-op. Hooks that throw are recorded but
     * do NOT abort the shutdown pass — every module gets a chance to clean up.
     */
    async shutdown(): Promise<ShutdownReport> {
        if (this.isShuttingDown) {
            return { completed: [], failed: [] }
        }
        this.isShuttingDown = true

        const { registry, logger } = this.deps
        const booted = new Set(this.bootedModules)
        const completed: string[] = []
        const failed: { module: string; error: Error }[] = []

        const reverse = [...registry.inBootOrder()].reverse()
        for (const m of reverse) {
            if (!booted.has(m.name)) continue
            if (!m.onShutdown) {
                completed.push(m.name)
                continue
            }
            try {
                await m.onShutdown()
                completed.push(m.name)
            } catch (cause) {
                const err =
                    cause instanceof Error ? cause : new Error(String(cause))
                failed.push({ module: m.name, error: err })
                logger.error(
                    { module: m.name, err },
                    `[module:${m.name}] onShutdown failed; continuing shutdown`,
                )
            }
        }

        this.bootedModules = []
        this.disposeSignals()
        return { completed, failed }
    }

    /**
     * Install OS signal handlers that trigger `shutdown()` on SIGTERM / SIGINT.
     * Returns a disposer that detaches them — useful for tests.
     */
    installSignalHandlers(
        signals: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'],
    ): () => void {
        const handler = (signal: NodeJS.Signals) => {
            this.deps.logger.info({ signal }, 'received shutdown signal')
            void this.shutdown()
        }
        for (const sig of signals) {
            process.on(sig, handler)
            this.signalDisposers.push(() => process.off(sig, handler))
        }
        return () => this.disposeSignals()
    }

    private disposeSignals(): void {
        for (const off of this.signalDisposers) off()
        this.signalDisposers = []
    }

    /** Names of modules whose `onBoot` has completed successfully. */
    bootedNames(): readonly string[] {
        return [...this.bootedModules]
    }
}

function wrapError(message: string, cause: unknown): Error {
    return new Error(
        `${message}: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause: cause instanceof Error ? cause : undefined },
    )
}

/** Internal helper — kept exported for tests that want to assert ordering. */
export function moduleSpecsInReverseBootOrder(
    registry: ModuleRegistry,
): readonly ModuleSpec[] {
    return [...registry.inBootOrder()].reverse()
}
