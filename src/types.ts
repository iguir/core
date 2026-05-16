import type { TLSOptions } from "bun";
/**
 * AppConfig defines the configuration options for the application.
 * It includes properties for the port, environment, and modules.
 * This interface can be extended to include additional configuration options as needed.
 */
export interface AppConfig {
    /**
     * The environment in which the application is running.
     * Can be 'development', 'production', or 'test'.
     * Default is 'development'.
     */
    environment: 'development' | 'production' | 'test';


    /**
     * An array of modules that the application will use.
     * Each module can be an object with its own configuration.
     * Default is an empty array.
     */
    modules: Array<{}>;

    roles: [],

    /**
     * Sever configuration options, including port, hostName, and TLS settings.
     */
    server: ServerConfig;
}


interface ServerConfig {
    port: number;

    /**
    * A flag to indicate whether to run the server in host mode.
    * If true, the server will be accessible from outside the machine.
    * This is useful for development and testing.
    */
    hostName?: '0.0.0.0' | 'localhost' | '127.0.0.1';

    /**
     * TLS configuration for the server. 
     * If provided, the server will run in HTTPS mode.
     */
    tls?: TLSOptions;
}