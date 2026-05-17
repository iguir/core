import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { resolveOptions, scanPages } from '../page-scanner'
import {
    isVirtualId,
    moduleFromVirtualId,
    renderIslandsClient,
    renderPagesManifest,
} from '../virtual-modules'
import { VIRTUAL_ISLANDS_ID, VIRTUAL_PAGES_PREFIX } from '../types'

const FIXTURE = resolve(import.meta.dir, '../../../tests/fixtures/vite-app')

describe('renderPagesManifest', () => {
    test('renders an empty manifest for an unknown module', () => {
        const src = renderPagesManifest('unknown', new Map())
        expect(src).toContain('export const pages = {};')
    })

    test('renders a lazy entry per page', () => {
        const pages = scanPages(resolveOptions({ root: FIXTURE }))
        const src = renderPagesManifest('blog', pages)
        expect(src).toContain('"index": () => __iguirEntry(import(')
        expect(src).toContain('"posts/[id]": () => __iguirEntry(import(')
        expect(src).toContain('export default pages;')
    })

    test('emits a normaliser that supports both default-export and named-export entries', () => {
        const pages = scanPages(resolveOptions({ root: FIXTURE }))
        const src = renderPagesManifest('blog', pages)
        expect(src).toContain('function __iguirEntry(promise)')
        expect(src).toContain("component: mod.default ?? mod.component")
    })
})

describe('renderIslandsClient', () => {
    test('emits an empty client when nothing was discovered', () => {
        const src = renderIslandsClient(new Map())
        expect(src).toContain('no pages discovered')
    })

    test('imports every discovered page eagerly', () => {
        const pages = scanPages(resolveOptions({ root: FIXTURE }))
        const src = renderIslandsClient(pages)
        expect(src).toContain('import(')
        // One eager import per page file.
        const importCount = src.match(/import\(/g)?.length ?? 0
        expect(importCount).toBe(3)
        expect(src).toContain('getDeclaredIslands')
        expect(src).toContain("document.querySelectorAll('iguir-island')")
    })
})

describe('virtual id helpers', () => {
    test('isVirtualId catches the prefix and the islands id', () => {
        expect(isVirtualId(VIRTUAL_ISLANDS_ID)).toBe(true)
        expect(isVirtualId(`${VIRTUAL_PAGES_PREFIX}blog`)).toBe(true)
        expect(isVirtualId('virtual:something-else')).toBe(false)
    })

    test('moduleFromVirtualId extracts the module name', () => {
        expect(moduleFromVirtualId(`${VIRTUAL_PAGES_PREFIX}blog`)).toBe('blog')
        expect(moduleFromVirtualId('virtual:other/x')).toBeNull()
    })
})
