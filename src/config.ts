import type { AppConfig, ServerConfig } from './types'

/** Defaults applied to every `defineConfig()` call. */
export const defaultConfig: Pick<AppConfig, 'environment' | 'server' | 'modules' | 'roles'> = {
    environment: 'development',
    modules: [],
    roles: {},
    server: {
        port: 3000,
        hostName: 'localhost',
    },
}

/**
 * Validate + freeze the application configuration. Call this once in
 * `app.config.ts`:
 *
 *   export default defineConfig({
 *     roles: appRoles,
 *     modules: [usersModule, postsModule],
 *     server: { port: 3000 },
 *   })
 *
 * The shape is intentionally narrow — anything we can't see at config-time
 * (validators, contracts, etc.) lives on the modules themselves.
 */
export function defineConfig(
    config: Partial<AppConfig> & Pick<AppConfig, 'roles' | 'modules'>,
): AppConfig {
    if (!config.roles || Object.keys(config.roles).length === 0) {
        throw new Error(
            '[config] defineConfig: `roles` is required and must contain at least one role. ' +
                'Use `defineRoles({...})` from `@iguir/core` to build it.',
        )
    }
    if (!Array.isArray(config.modules)) {
        throw new TypeError('[config] defineConfig: `modules` must be an array')
    }

    const server: ServerConfig = {
        ...defaultConfig.server,
        ...(config.server ?? {}),
    }
    if (!Number.isInteger(server.port) || server.port < 1 || server.port > 65535) {
        throw new Error(
            `[config] server.port must be an integer in [1, 65535]; got ${server.port}`,
        )
    }

    return Object.freeze({
        ...defaultConfig,
        ...config,
        server: Object.freeze(server),
    }) as AppConfig
}
