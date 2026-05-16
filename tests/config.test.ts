import { describe, expect, test } from 'bun:test'
import { defineRoles } from '../src/acl/roles'
import { defineConfig } from '../src/config'

const roles = defineRoles({ admin: { description: 'Admin' } })

describe('defineConfig', () => {
    test('returns a frozen config with defaults applied', () => {
        const cfg = defineConfig({ roles, modules: [] })
        expect(cfg.environment).toBe('development')
        expect(cfg.server.port).toBe(3000)
        expect(cfg.server.hostName).toBe('localhost')
        expect(Object.isFrozen(cfg)).toBe(true)
        expect(Object.isFrozen(cfg.server)).toBe(true)
    })

    test('rejects an empty roles map', () => {
        expect(() => defineConfig({ roles: {}, modules: [] })).toThrow(/roles/)
    })

    test('rejects an out-of-range port', () => {
        expect(() =>
            defineConfig({ roles, modules: [], server: { port: 0 } }),
        ).toThrow(/server.port/)
        expect(() =>
            defineConfig({ roles, modules: [], server: { port: 70000 } }),
        ).toThrow(/server.port/)
    })

    test('user-supplied server overrides merge with defaults', () => {
        const cfg = defineConfig({
            roles,
            modules: [],
            server: { port: 8080 },
        })
        expect(cfg.server.port).toBe(8080)
        expect(cfg.server.hostName).toBe('localhost')
    })
})
