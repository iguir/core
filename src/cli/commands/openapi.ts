import { defineCommand } from 'citty'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { DefinedRoutes } from '../../routing/code'
import { generateOpenApi } from '../../routing/openapi'
import { resolveAppConfig } from '../resolve-config'
import { c } from '../format'

export const openapiCommand = defineCommand({
    meta: {
        name: 'openapi',
        description: 'Generate an OpenAPI 3.1 document from declared routes.',
    },
    args: {
        config: {
            type: 'string',
            description: 'Path to app.config.ts (auto-discovered if omitted).',
        },
        out: {
            type: 'string',
            description: 'Write the document to this file instead of stdout.',
        },
        title: {
            type: 'string',
            description: 'OpenAPI info.title.',
            default: 'API',
        },
        version: {
            type: 'string',
            description: 'OpenAPI info.version.',
            default: '1.0.0',
        },
        description: {
            type: 'string',
            description: 'OpenAPI info.description.',
        },
        server: {
            type: 'string',
            description: 'Add a server URL (repeatable).',
        },
        pretty: {
            type: 'boolean',
            description: 'Pretty-print JSON (defaults to true; pass --no-pretty to disable).',
            default: true,
        },
    },
    async run({ args }) {
        const { config, rootDir } = await resolveAppConfig({ explicit: args.config })

        // Make sure every module's `declared` is populated — defineRoutes is lazy.
        for (const m of config.modules) {
            if (!m.routes) continue
            const defined = m.routes.handler as unknown as DefinedRoutes
            if (defined.declared.length === 0) {
                try {
                    await defined.build({} as never)
                } catch {
                    // Same fallback as the routes command: declared is filled up to failure.
                }
            }
        }

        const servers = Array.isArray(args.server)
            ? (args.server as string[])
            : args.server
              ? [args.server as string]
              : undefined

        const doc = generateOpenApi(config.modules, {
            info: {
                title: args.title as string,
                version: args.version as string,
                description: args.description as string | undefined,
            },
            servers: servers?.map((url) => ({ url })),
        })

        const json = args.pretty
            ? JSON.stringify(doc, null, 2)
            : JSON.stringify(doc)

        if (args.out) {
            const outFile = resolve(rootDir, args.out as string)
            await writeFile(outFile, json + '\n', 'utf8')
            console.log(
                c.dim(`Wrote OpenAPI document to `) +
                    c.cyan(outFile) +
                    c.dim(` (${Object.keys(doc.paths).length} paths)`),
            )
            return
        }
        process.stdout.write(json + '\n')
    },
})
