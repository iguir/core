import type { JsxElement } from './types'

/**
 * Internal registry of every island declared in the running process. The
 * vite-plugin reads this at build time to know which components need a
 * client-side hydration entry. Runtime code never reads it.
 */
const ISLANDS = new Map<string, IslandRecord>()

/** Bookkeeping for one island declaration. */
export interface IslandRecord {
    name: string
    // biome-ignore lint/suspicious/noExplicitAny: components are user-shaped
    component: (props: any) => JsxElement | Promise<JsxElement>
}

/**
 * Wrap a component so the server renders its initial HTML inside a marker
 * element with the props serialised onto a data attribute. The client-side
 * bundle (shipped by `@iguir/vite-plugin`) finds every `<iguir-island>` and
 * hydrates it with the matching component.
 *
 *   export const Counter = defineIsland('Counter', ({ initial = 0 }) => {
 *     // hono/jsx component — runs on both server and client
 *   })
 *
 * The same component runs server-side for the initial HTML, so islands are
 * fully SSR'd and degrade gracefully if JS fails to load.
 */
export function defineIsland<TProps extends Record<string, unknown>>(
    name: string,
    component: (props: TProps) => JsxElement | Promise<JsxElement>,
): (props: TProps) => JsxElement {
    if (!name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(
            `[jsx] island name "${name}" is invalid. ` +
                'Use PascalCase or camelCase identifiers.',
        )
    }
    const existing = ISLANDS.get(name)
    if (existing && existing.component !== component) {
        throw new Error(
            `[jsx] island "${name}" was declared twice with different components. ` +
                'Pick a unique name per island.',
        )
    }
    ISLANDS.set(name, { name, component })

    const Wrapped = (props: TProps): JsxElement => {
        const serialised = safeJsonStringify(props)
        const rendered = component(props) as JsxElement
        // `iguir-island` is a plain custom element. The hydration script
        // (shipped by @iguir/vite-plugin) selects every such element and
        // boots the matching component using `data-name` + `data-props`.
        return (
            <iguir-island data-name={name} data-props={serialised}>
                {rendered}
            </iguir-island>
        )
    }
    Object.defineProperty(Wrapped, 'name', { value: `Island(${name})` })
    return Wrapped
}

/** Plugin-facing accessor: every island declared so far. */
export function getDeclaredIslands(): readonly IslandRecord[] {
    return [...ISLANDS.values()]
}

/** Test helper: clear the registry. Not exported from the public surface. */
export function _resetIslandRegistry(): void {
    ISLANDS.clear()
}

function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value ?? {})
    } catch {
        return '{}'
    }
}

// Tell TypeScript about the custom element so authors can use `<iguir-island>`
// in raw JSX if they want to (rare — mostly internal).
declare module 'hono/jsx/jsx-dev-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            'iguir-island': {
                'data-name': string
                'data-props': string
                children?: unknown
            }
        }
    }
}
