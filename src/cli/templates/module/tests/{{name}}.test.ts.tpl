import { describe, expect, test } from 'bun:test'
import { {{nameCamel}}Module } from '../{{name}}.module'

describe('{{name}} module', () => {
    test('module is named correctly', () => {
        expect({{nameCamel}}Module.name).toBe('{{name}}')
    })
})
