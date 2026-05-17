import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

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
    const code = await proc.exited
    return { code, stdout, stderr }
}

describe('iguir routes', () => {
    test('lists every declared route from the fixture app', async () => {
        const { code, stdout } = await runCli(['routes'])
        expect(code).toBe(0)
        expect(stdout).toContain('GET')
        expect(stdout).toContain('POST')
        expect(stdout).toContain('DELETE')
        expect(stdout).toContain('/api/posts')
        expect(stdout).toContain('posts.list')
        expect(stdout).toContain('posts.create')
        expect(stdout).toContain('posts.delete')
        expect(stdout).toContain('4 routes across 1 modules')
    })

    test('--json emits parseable JSON', async () => {
        const { code, stdout } = await runCli(['routes', '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(stdout) as Array<{
            method: string
            path: string
            module: string
            permission?: string
            auth: boolean
        }>
        expect(data.length).toBe(4)
        const del = data.find((r) => r.method === 'DELETE')!
        expect(del.path).toBe('/api/posts/:id')
        expect(del.permission).toBe('posts.delete')
        expect(del.auth).toBe(true)
        const health = data.find((r) => r.path === '/api/posts/health')!
        expect(health.auth).toBe(false)
        expect(health.permission).toBeUndefined()
    })

    test('--config <explicit> bypasses upward walk', async () => {
        const { code, stdout } = await runCli([
            'routes',
            '--config',
            resolve(FIXTURE, 'app.config.ts'),
            '--json',
        ])
        expect(code).toBe(0)
        expect(JSON.parse(stdout).length).toBe(4)
    })

    test('exits non-zero with a clear message when no config is found', async () => {
        const proc = Bun.spawn(['bun', CLI, 'routes'], {
            cwd: '/tmp',
            env: { ...process.env, NO_COLOR: '1' },
            stdout: 'pipe',
            stderr: 'pipe',
        })
        const stderr = await new Response(proc.stderr).text()
        const code = await proc.exited
        expect(code).not.toBe(0)
        expect(stderr).toContain('could not find app.config.ts')
    })
})
