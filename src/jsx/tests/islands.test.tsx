import { afterEach, describe, expect, test } from 'bun:test'
import {
    _resetIslandRegistry,
    defineIsland,
    getDeclaredIslands,
} from '../islands'

async function renderToString(node: unknown): Promise<string> {
    if (node == null) return ''
    if (typeof node === 'string') return node
    if (node instanceof Promise) return renderToString(await node)
    const ts = (node as { toString?: () => string | Promise<string> }).toString
    if (typeof ts === 'function') {
        const out = ts.call(node)
        return out instanceof Promise ? await out : out
    }
    return String(node)
}

afterEach(() => _resetIslandRegistry())

describe('defineIsland', () => {
    test('returns a component that renders an <iguir-island> placeholder', async () => {
        const Counter = defineIsland('Counter', ({ initial }: { initial: number }) => (
            <button>{`Count: ${initial}`}</button>
        ))
        const html = await renderToString(Counter({ initial: 7 }))

        expect(html).toContain('<iguir-island')
        expect(html).toContain('data-name="Counter"')
        expect(html).toContain('data-props="{&quot;initial&quot;:7}"')
        expect(html).toContain('Count: 7')
    })

    test('registers the island for plugin enumeration', () => {
        defineIsland('Counter', () => '<x />' as unknown as Promise<never>)
        defineIsland('Toggle', () => '<x />' as unknown as Promise<never>)
        const names = getDeclaredIslands().map((i) => i.name).sort()
        expect(names).toEqual(['Counter', 'Toggle'])
    })

    test('rejects invalid island names', () => {
        expect(() =>
            defineIsland('Bad Name', () => '<x />' as never),
        ).toThrow(/invalid/)
        expect(() =>
            defineIsland('', () => '<x />' as never),
        ).toThrow(/invalid/)
    })

    test('rejects duplicate names with different components', () => {
        defineIsland('Counter', () => '<x />' as never)
        expect(() =>
            defineIsland('Counter', () => '<y />' as never),
        ).toThrow(/declared twice/)
    })

    test('re-declaring the same component is idempotent', () => {
        const Comp = () => '<x />' as never
        defineIsland('Counter', Comp)
        expect(() => defineIsland('Counter', Comp)).not.toThrow()
    })
})
