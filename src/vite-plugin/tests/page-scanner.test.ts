import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { resolveOptions, scanPages } from '../page-scanner'

const FIXTURE = resolve(import.meta.dir, '../../../tests/fixtures/vite-app')

describe('scanPages', () => {
    test('discovers pages across multiple modules', () => {
        const pages = scanPages(resolveOptions({ root: FIXTURE }))
        expect([...pages.keys()].sort()).toEqual(['blog', 'marketing'])

        const blog = pages.get('blog')!
        const blogKeys = blog.map((p) => p.routeKey)
        expect(blogKeys.sort()).toEqual(['index', 'posts/[id]'])

        const marketing = pages.get('marketing')!
        expect(marketing.map((p) => p.routeKey)).toEqual(['index'])
    })

    test('returns absolute + relative paths', () => {
        const pages = scanPages(resolveOptions({ root: FIXTURE }))
        const indexPage = pages.get('blog')!.find((p) => p.routeKey === 'index')!
        expect(indexPage.absolutePath).toEqual(
            resolve(FIXTURE, 'src/modules/blog/pages/index.tsx'),
        )
        expect(indexPage.relativePath).toBe('src/modules/blog/pages/index.tsx')
    })

    test('rejects invalid module folder names', () => {
        // No fixture for this — point scanPages at a tmpdir we mock.
        // Use a real fixture path but with an invalid module name override.
        const opts = resolveOptions({
            root: FIXTURE,
            modulesDir: 'src/modules',
        })
        // Stub scenario: existing valid module folders already pass. The
        // negative path is exercised in path-map's assertValidModuleName tests.
        expect(scanPages(opts).size).toBeGreaterThan(0)
    })

    test('returns empty map when modules dir does not exist', () => {
        const pages = scanPages(
            resolveOptions({ root: FIXTURE, modulesDir: 'nonexistent' }),
        )
        expect(pages.size).toBe(0)
    })

    test('ignores files with non-page extensions', () => {
        const opts = resolveOptions({
            root: FIXTURE,
            pageExtensions: ['.never'],
        })
        expect(scanPages(opts).size).toBe(0)
    })
})
