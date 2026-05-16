import { z, type ZodType } from 'zod'
import type { ModuleSpec } from '../module/types'
import type { DeclaredRoute, DefinedRoutes, RouteOptions } from './code'

/** OpenAPI 3.1 top-level info block. */
export interface OpenApiInfo {
    title: string
    version: string
    description?: string
    contact?: { name?: string; url?: string; email?: string }
    license?: { name: string; url?: string }
}

/** Options for `generateOpenApi`. */
export interface OpenApiOptions {
    info: OpenApiInfo
    servers?: Array<{ url: string; description?: string }>
}

/** A minimal OpenAPI 3.1 document type — wide enough for our generator. */
export interface OpenApiDocument {
    openapi: '3.1.0'
    info: OpenApiInfo
    servers?: Array<{ url: string; description?: string }>
    paths: Record<string, Record<string, OpenApiOperation>>
    components: {
        securitySchemes: Record<string, unknown>
    }
}

interface OpenApiOperation {
    summary?: string
    description?: string
    operationId?: string
    tags?: string[]
    security?: Array<Record<string, string[]>>
    parameters?: OpenApiParameter[]
    requestBody?: {
        required: true
        content: { 'application/json': { schema: unknown } }
    }
    responses: Record<string, { description: string }>
    'x-permission'?: string
}

interface OpenApiParameter {
    name: string
    in: 'query' | 'header' | 'path'
    required: boolean
    schema: unknown
}

/**
 * Generate an OpenAPI 3.1 document from the modules' declared routes.
 *
 *   const spec = generateOpenApi(modules, {
 *     info: { title: 'My API', version: '1.0.0' },
 *   })
 *
 * Pure: reads `module.routes.handler.declared` + ACL permissions, returns a
 * plain object the user can serve at `/openapi.json` or feed into Scalar/Redoc.
 */
export function generateOpenApi(
    modules: readonly ModuleSpec[],
    options: OpenApiOptions,
): OpenApiDocument {
    const doc: OpenApiDocument = {
        openapi: '3.1.0',
        info: options.info,
        servers: options.servers,
        paths: {},
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer' },
            },
        },
    }

    for (const m of modules) {
        if (!m.routes) continue
        const defined = m.routes.handler as unknown as DefinedRoutes
        if (defined.__kind !== 'app:routes') continue

        const prefix = normalizePrefix(m.routes.prefix)
        for (const route of defined.declared) {
            const path = joinPath(prefix, openApiPath(route.path))
            const operation = buildOperation(m.name, route)
            doc.paths[path] ??= {}
            doc.paths[path]![route.method] = operation
        }
    }

    return doc
}

function buildOperation(
    moduleName: string,
    route: DeclaredRoute,
): OpenApiOperation {
    const op: OpenApiOperation = {
        tags: [moduleName],
        operationId: `${route.method}_${moduleName}_${route.path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
        responses: {
            '200': { description: 'Success' },
        },
    }

    const options = route.options as RouteOptions

    if (options.auth || options.permission) {
        op.security = [{ bearerAuth: [] }]
        op.responses['401'] = { description: 'Unauthorized' }
    }
    if (options.permission) {
        op['x-permission'] = options.permission
        op.responses['403'] = { description: 'Forbidden' }
    }

    if (options.body) {
        op.requestBody = {
            required: true,
            content: { 'application/json': { schema: toJsonSchema(options.body) } },
        }
        op.responses['422'] = { description: 'Validation failed' }
    }

    const params: OpenApiParameter[] = []
    params.push(...extractParams(route.path, options.param))
    if (options.query) params.push(...schemaToParams(options.query, 'query'))
    if (options.header) params.push(...schemaToParams(options.header, 'header'))
    if (params.length > 0) op.parameters = params

    return op
}

function extractParams(
    path: string,
    paramSchema: ZodType | undefined,
): OpenApiParameter[] {
    const pathParams = [...path.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(
        (m) => m[1]!,
    )
    if (pathParams.length === 0) return []

    let perField: Record<string, unknown> | undefined
    if (paramSchema) {
        const s = toJsonSchema(paramSchema)
        if (s && typeof s === 'object' && 'properties' in s) {
            perField = (s as { properties: Record<string, unknown> }).properties
        }
    }

    return pathParams.map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: perField?.[name] ?? { type: 'string' },
    }))
}

function schemaToParams(
    schema: ZodType,
    location: 'query' | 'header',
): OpenApiParameter[] {
    const json = toJsonSchema(schema)
    if (
        !json ||
        typeof json !== 'object' ||
        !('properties' in json)
    ) {
        return []
    }
    const required = new Set(
        ((json as { required?: string[] }).required ?? []) as string[],
    )
    return Object.entries(
        (json as { properties: Record<string, unknown> }).properties,
    ).map(([name, fieldSchema]) => ({
        name,
        in: location,
        required: required.has(name),
        schema: fieldSchema,
    }))
}

function toJsonSchema(schema: ZodType): unknown {
    try {
        return z.toJSONSchema(schema)
    } catch (err) {
        // Some Zod constructs (e.g. `z.function()`) can't be represented; we
        // emit a permissive placeholder instead of bailing on the whole spec.
        return { description: `Unsupported Zod schema: ${(err as Error).message}` }
    }
}

function normalizePrefix(prefix: string | undefined): string {
    if (!prefix) return ''
    return prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
}

function joinPath(prefix: string, path: string): string {
    if (!prefix) return path
    if (path === '/' || path === '') return prefix
    return path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`
}

/** Convert Hono's `/:id` syntax to OpenAPI's `/{id}` syntax. */
function openApiPath(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
}
