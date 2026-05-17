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
    return { code: await proc.exited, stdout, stderr }
}

describe('iguir dev/start', () => {
    test('fails clearly when no entrypoint exists', async () => {
        // The fixture has no src/main.ts — confirm the message is actionable.
        const { code, stderr } = await runCli(['dev'])
        expect(code).not.toBe(0)
        expect(stderr).toMatch(/could not find a server entrypoint/)
        expect(stderr).toMatch(/src\/main\.ts/)
    })
})

describe('iguir help', () => {
    test('lists all subcommands', async () => {
        const { code, stdout } = await runCli(['--help'])
        // citty exits 0 for --help.
        expect(code).toBe(0)
        expect(stdout).toContain('routes')
        expect(stdout).toContain('acl')
        expect(stdout).toContain('openapi')
        expect(stdout).toContain('dev')
        expect(stdout).toContain('start')
        expect(stdout).toContain('build')
        expect(stdout).toContain('test')
    })
})
