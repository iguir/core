import { afterEach, describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createApp } from '../index'

let workdir: string

afterEach(async () => {
    if (workdir) await rm(workdir, { recursive: true, force: true })
})

async function fresh(): Promise<string> {
    workdir = await mkdtemp(join(tmpdir(), 'iguir-createapp-'))
    return workdir
}

describe('createApp', () => {
    test('writes the full project tree', async () => {
        const root = await fresh()
        const target = join(root, 'my-app')
        const { rootDir, files } = await createApp({ target })

        expect(rootDir).toBe(resolve(target))
        expect(files.length).toBeGreaterThan(10)

        const expected = [
            'package.json',
            'tsconfig.json',
            'biome.json',
            'bunfig.toml',
            '.gitignore',
            'README.md',
            'app.config.ts',
            'src/main.ts',
            'src/app/acl.ts',
            'src/app/env.ts',
            'src/app/db.ts',
            'src/app/auth.ts',
            'src/modules/posts/posts.module.ts',
            'src/modules/posts/posts.contract.ts',
            'src/modules/posts/posts.acl.ts',
            'src/modules/posts/routes/api.ts',
            'src/modules/posts/services/index.ts',
            'src/modules/posts/tests/posts.test.ts',
            'tests/auth.test.ts',
            'vite.config.ts',
        ]
        for (const rel of expected) {
            expect(existsSync(join(rootDir, rel))).toBe(true)
        }
    })

    test('templates are rendered with name + coreVersion', async () => {
        const root = await fresh()
        const target = join(root, 'foo-bar')
        await createApp({ target, name: 'foo-bar', coreVersion: '^9.9.9' })
        const pkg = JSON.parse(
            await readFile(join(target, 'package.json'), 'utf8'),
        ) as { name: string; dependencies: Record<string, string> }
        expect(pkg.name).toBe('foo-bar')
        expect(pkg.dependencies['@iguir/core']).toBe('^9.9.9')

        const readme = await readFile(join(target, 'README.md'), 'utf8')
        expect(readme).toContain('# foo-bar')
    })

    test('refuses non-empty targets without --force', async () => {
        const root = await fresh()
        const target = join(root, 'occupied')
        await createApp({ target })
        await expect(createApp({ target })).rejects.toThrow(/already exists/)
    })

    test('--force overwrites an existing tree', async () => {
        const root = await fresh()
        const target = join(root, 'reuse')
        await createApp({ target })
        const result = await createApp({ target, force: true })
        expect(result.files.length).toBeGreaterThan(10)
    })

    test('rejects invalid project names', async () => {
        const root = await fresh()
        const target = join(root, 'Bad Name')
        await expect(createApp({ target, name: 'Bad Name' })).rejects.toThrow(
            /invalid/,
        )
    })

    test('generated package.json is valid JSON', async () => {
        const root = await fresh()
        const target = join(root, 'valid-json-check')
        await createApp({ target })
        const pkg = JSON.parse(
            await readFile(join(target, 'package.json'), 'utf8'),
        )
        expect(pkg.scripts).toBeDefined()
        expect(pkg.dependencies['@iguir/core']).toBeDefined()
    })

    test('biome.json includes the cross-module-import lint rule', async () => {
        const root = await fresh()
        const target = join(root, 'lint-rule-check')
        await createApp({ target })
        const biome = JSON.parse(
            await readFile(join(target, 'biome.json'), 'utf8'),
        ) as {
            linter: {
                rules: {
                    style: {
                        noRestrictedImports: { options: { paths: Record<string, string> } }
                    }
                }
            }
        }
        const paths = biome.linter.rules.style.noRestrictedImports.options.paths
        expect(Object.keys(paths).join(' ')).toMatch(/contract/)
    })
})
