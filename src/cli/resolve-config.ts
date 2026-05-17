import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import type { AppConfig } from '../types'

/** Names searched (in order) when walking upward for the app config file. */
const CONFIG_NAMES = ['app.config.ts', 'app.config.js', 'app.config.mjs']

/** Result of `resolveAppConfig`: the loaded config + the file it came from. */
export interface ResolvedAppConfig {
    config: AppConfig
    file: string
    /** Directory containing the config file — useful as the cwd for sub-commands. */
    rootDir: string
}

/**
 * Find an `app.config.{ts,js,mjs}` by walking up from `from` (or cwd), then
 * dynamic-import it. The file must `export default defineConfig(...)`.
 *
 *   const { config, rootDir } = await resolveAppConfig()
 *
 * Throws actionable errors with the `[cli]` tag — no silent fallbacks.
 */
export async function resolveAppConfig(options: {
    from?: string
    explicit?: string
} = {}): Promise<ResolvedAppConfig> {
    const file = options.explicit
        ? resolve(options.explicit)
        : findConfigUpward(options.from ?? process.cwd())

    if (!file) {
        throw new Error(
            '[cli] could not find app.config.ts. ' +
                'Run from inside an app project (or use --config <path>).',
        )
    }
    if (!existsSync(file)) {
        throw new Error(`[cli] config file does not exist: ${file}`)
    }

    let mod: { default?: unknown }
    try {
        mod = (await import(file)) as { default?: unknown }
    } catch (err) {
        throw new Error(
            `[cli] failed to import ${file}: ${(err as Error).message}`,
            { cause: err instanceof Error ? err : undefined },
        )
    }

    const config = mod.default
    if (!config || typeof config !== 'object') {
        throw new Error(
            `[cli] ${file} must \`export default defineConfig({ ... })\`. ` +
                `Got: ${typeof config}`,
        )
    }
    if (!('roles' in config) || !('modules' in config)) {
        throw new Error(
            `[cli] ${file} default export is missing required fields. ` +
                'Did you forget to call defineConfig()?',
        )
    }

    return {
        config: config as AppConfig,
        file,
        rootDir: dirname(file),
    }
}

function findConfigUpward(start: string): string | null {
    let current = resolve(start)
    // Stop at the filesystem root.
    while (true) {
        for (const name of CONFIG_NAMES) {
            const candidate = resolve(current, name)
            if (existsSync(candidate)) return candidate
        }
        const parent = dirname(current)
        if (parent === current) return null
        current = parent
    }
}
