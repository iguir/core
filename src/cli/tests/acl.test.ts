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

describe('app acl', () => {
    test('default dump shows roles + permissions + summary', async () => {
        const { code, stdout } = await runCli(['acl'])
        expect(code).toBe(0)
        expect(stdout).toContain('ROLES')
        expect(stdout).toContain('PERMISSIONS')
        expect(stdout).toContain('admin')
        expect(stdout).toContain('editor')
        expect(stdout).toContain('viewer')
        expect(stdout).toContain('posts.create')
        expect(stdout).toContain('posts.delete')
        expect(stdout).toContain('strict')
        expect(stdout).toContain('3 roles, 3 permissions, 1 modules.')
    })

    test('--role <name> drills down to that role', async () => {
        const { code, stdout } = await runCli(['acl', '--role', 'editor'])
        expect(code).toBe(0)
        expect(stdout).toContain('editor')
        expect(stdout).toContain('posts.create')
        expect(stdout).toContain('posts.list')
        expect(stdout).not.toContain('posts.delete')
        expect(stdout).toContain('2 permissions')
    })

    test('--permission <name> drills down to that permission', async () => {
        const { code, stdout } = await runCli([
            'acl',
            '--permission',
            'posts.delete',
        ])
        expect(code).toBe(0)
        expect(stdout).toContain('posts.delete')
        expect(stdout).toContain('strict')
        expect(stdout).toContain('admin')
        expect(stdout).toContain('Granted by 1 roles.')
    })

    test('unknown --role exits non-zero with a helpful message', async () => {
        const { code, stderr } = await runCli(['acl', '--role', 'nope'])
        expect(code).not.toBe(0)
        expect(stderr).toContain('not declared')
        expect(stderr).toContain('Known roles')
    })

    test('--json emits a parseable dump', async () => {
        const { code, stdout } = await runCli(['acl', '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(stdout) as {
            roles: Array<{ name: string; permissions: string[] }>
            permissions: Array<{ permission: string; mode: string; roles: string[] }>
            modules: Array<{ module: string; permissions: string[] }>
        }
        expect(data.roles.find((r) => r.name === 'admin')?.permissions).toContain(
            'posts.delete',
        )
        expect(
            data.permissions.find((p) => p.permission === 'posts.delete')?.mode,
        ).toBe('strict')
        expect(data.modules[0]?.module).toBe('posts')
    })
})
