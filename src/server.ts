import { Hono } from "hono";
import type { AppConfig } from "./types";

/**
 * The function that starts the server using Bun.
 * in hte next coming versions this will runtime agnostic and will support other runtimes like Node.js and Deno as well.
 */
export default function serve(app: Hono, config: Pick<AppConfig, 'server'>['server']) {
    return Bun.serve({

        // Run in host mode if the --host flag is provided, otherwise run in localhost mode.
        // This allows the server to be accessible from outside the machine when running in host mode, which is useful for development and testing.
        hostname: config.hostName || 'localhost',

        port: config.port,
        fetch: app.fetch,

        tls: config.tls ? {
            cert: config.tls.cert,
            key: config.tls.key,
            ca: config.tls.ca
        } : undefined
    });
}