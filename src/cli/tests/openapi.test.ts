import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { rm } from 'node:fs/promises'

const FIXTURE = resolve(import.meta.dir, '../../../tests/fixtures/sample-app')
const CLI = resolve(import.meta.dir, '../main.ts')

async function runCli(args: string[]): Promise<{
    code: number
    stdout: string
    stderr: string
}> {
    const proc = Bun.spawn(['bun', CLI, ...args], {
        cwd: FIXTURE,
        env: { ...process.env, NO_COLOR: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
    })
    const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
    ])
    return { code: await proc.exited, stdout, stderr }
}

describe('iguir openapi', () => {
    test('prints a valid 3.1 document to stdout', async () => {
        const { code, stdout } = await runCli([
            'openapi',
            '--title',
            'Sample API',
            '--version',
            '2.0.0',
        ])
        expect(code).toBe(0)
        const doc = JSON.parse(stdout) as {
            openapi: string
            info: { title: string; version: string }
            paths: Record<string, Record<string, unknown>>
        }
        expect(doc.openapi).toBe('3.1.0')
        expect(doc.info.title).toBe('Sample API')
        expect(doc.info.version).toBe('2.0.0')
        expect(doc.paths['/api/posts']).toBeDefined()
        expect(doc.paths['/api/posts']!.get).toBeDefined()
        expect(doc.paths['/api/posts']!.post).toBeDefined()
        expect(doc.paths['/api/posts/{id}']).toBeDefined()
        expect(doc.paths['/api/posts/health']).toBeDefined()
    })

    test('--out writes the document to a file', async () => {
        const out = resolve(FIXTURE, 'openapi.json')
        try {
            const { code, stdout } = await runCli(['openapi', '--out', 'openapi.json'])
            expect(code).toBe(0)
            expect(stdout).toContain('Wrote OpenAPI document')
            const written = await Bun.file(out).json() as { openapi: string }
            expect(written.openapi).toBe('3.1.0')
        } finally {
            await rm(out, { force: true })
        }
    })
})
