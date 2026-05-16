/**
 * Configuration for the application.
 * This file defines the structure of the configuration object and provides default values.
 * It can be extended to include additional configuration options as needed.
 */
import type { AppConfig } from "./types";


/**
 * Default configuration values for the application.
 */
export const defaultConfig: AppConfig = {
    environment: 'development',
    modules: [],

    roles: [],

    server: {
        port: 3000,
        hostName: 'localhost',
        tls: undefined
    }
};

/**
 * Function to load the configuration from a file or environment variables.
 * This function can be extended to include logic for merging default values with user-provided values.
 */
export function defineConfig(config: Partial<AppConfig>): AppConfig {

    // Todo: later we will add some sort of validation here 
    // to ensure the provided configuration is valid and complete.

    return {
        ...defaultConfig,
        ...config
    };
}