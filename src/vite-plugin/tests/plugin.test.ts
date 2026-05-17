/**
 * Integration tests for the Vite plugin. We exercise the real plugin against
 * Vite's programmatic API in middleware mode, then ask Vite to transform
 * the virtual modules and assert on the returned source.
 */
import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import iguir from '../index'
import { VIRTUAL_ISLANDS_ID, VIRTUAL_PAGES_PREFIX } from '../types'

const FIXTURE = resolve(import.meta.dir, '../../../tests/fixtures/vite-app')

async function withViteServer<T>(fn: (server: Awaited<ReturnType<typeof createServer>>) => Promise<T>): Promise<T> {
    const server = await createServer({
        root: FIXTURE,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false },
        plugins: [iguir({ root: FIXTURE })],
    })
    try {
        return await fn(server)
    } finally {
        await server.close()
    }
}

describe('iguir vite plugin', () => {
    test('exposes virtual:iguir-pages/<module> with a lazy manifest', async () => {
        await withViteServer(async (server) => {
            const id = `${VIRTUAL_PAGES_PREFIX}blog`
            const transformed = await server.transformRequest(id)
            expect(transformed).not.toBeNull()
            expect(transformed!.code).toContain('"index"')
            expect(transformed!.code).toContain('"posts/[id]"')
        })
    })

    test('virtual:iguir-pages/<unknown-module> returns an empty manifest', async () => {
        await withViteServer(async (server) => {
            const id = `${VIRTUAL_PAGES_PREFIX}does-not-exist`
            const transformed = await server.transformRequest(id)
            expect(transformed!.code).toContain('export const pages = {}')
        })
    })

    test('exposes virtual:iguir-islands with hydration runtime (load hook)', async () => {
        await withViteServer(async (server) => {
            // We bypass transformRequest here because that resolves bare
            // imports like `@iguir/core/jsx` against the fixture's
            // node_modules, which doesn't exist. The generated source is what
            // matters for the contract.
            const resolved = await server.pluginContainer.resolveId(
                VIRTUAL_ISLANDS_ID,
            )
            expect(resolved).not.toBeNull()
            const loaded = await server.pluginContainer.load(resolved!.id)
            const code = typeof loaded === 'string' ? loaded : loaded?.code
            expect(code).toContain('getDeclaredIslands')
            expect(code).toContain('iguir-island')
        })
    })

    test('ignores ids it does not own', async () => {
        await withViteServer(async (server) => {
            // Vite would return null for a truly unknown id; our plugin
            // shouldn't intercept these.
            const id = 'virtual:not-ours'
            const transformed = await server.transformRequest(id).catch(() => null)
            expect(transformed).toBeNull()
        })
    })
})
