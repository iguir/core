import { afterEach, describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'

const FIXTURE = resolve(import.meta.dir, '../../../tests/fixtures/sample-app')
const CLI = resolve(import.meta.dir, '../main.ts')
const GEN_ROOT = resolve(FIXTURE, 'src/modules')

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

async function cleanup(name: string) {
    await rm(resolve(GEN_ROOT, name), { recursive: true, force: true })
}

describe('iguir generate module', () => {
    afterEach(async () => {
        for (const n of ['billing', 'bad_name', 'pages_only', 'minimal']) {
            await cleanup(n)
        }
    })

    test('default features scaffold a complete module', async () => {
        const { code, stdout } = await runCli(['generate', 'module', 'billing'])
        expect(code).toBe(0)
        expect(stdout).toContain('Generated module')

        const dir = resolve(GEN_ROOT, 'billing')
        expect(existsSync(resolve(dir, 'billing.module.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'billing.contract.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'billing.acl.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'routes/api.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'services/index.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'tests/billing.test.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'events.ts'))).toBe(false)

        const moduleSrc = await Bun.file(resolve(dir, 'billing.module.ts')).text()
        expect(moduleSrc).toContain("name: 'billing'")
        expect(moduleSrc).toContain('billingAcl')
        expect(moduleSrc).toContain('billingContract')
        expect(moduleSrc).toContain('apiRoutes')
    })

    test('--with picks specific features only', async () => {
        const { code } = await runCli([
            'generate',
            'module',
            'minimal',
            '--with',
            'acl,tests',
        ])
        expect(code).toBe(0)
        const dir = resolve(GEN_ROOT, 'minimal')
        expect(existsSync(resolve(dir, 'minimal.module.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'minimal.acl.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'tests/minimal.test.ts'))).toBe(true)
        expect(existsSync(resolve(dir, 'minimal.contract.ts'))).toBe(false)
        expect(existsSync(resolve(dir, 'routes/api.ts'))).toBe(false)
        expect(existsSync(resolve(dir, 'services/index.ts'))).toBe(false)
    })

    test('rejects bad module names', async () => {
        const { code, stderr } = await runCli(['generate', 'module', 'BadName'])
        expect(code).not.toBe(0)
        expect(stderr).toContain('invalid')
    })

    test('refuses to overwrite without --force', async () => {
        await runCli(['generate', 'module', 'billing'])
        const { code, stderr } = await runCli(['generate', 'module', 'billing'])
        expect(code).not.toBe(0)
        expect(stderr).toMatch(/already exists/)

        const forced = await runCli(['generate', 'module', 'billing', '--force'])
        expect(forced.code).toBe(0)
    })

    test('rejects unknown features in --with', async () => {
        const { code, stderr } = await runCli([
            'generate',
            'module',
            'billing',
            '--with',
            'bogus',
        ])
        expect(code).not.toBe(0)
        expect(stderr).toContain('unknown feature')
    })
})
