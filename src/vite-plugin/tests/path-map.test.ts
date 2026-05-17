import { describe, expect, test } from 'bun:test'
import { filePathToRouteKey, routeKeyToHonoPath } from '../path-map'

describe('filePathToRouteKey', () => {
    test('index.tsx → "index"', () => {
        expect(filePathToRouteKey('index.tsx', ['.tsx'])).toBe('index')
    })

    test('about.tsx → "about"', () => {
        expect(filePathToRouteKey('about.tsx', ['.tsx'])).toBe('about')
    })

    test('posts/[id].tsx → "posts/[id]"', () => {
        expect(filePathToRouteKey('posts/[id].tsx', ['.tsx'])).toBe('posts/[id]')
    })

    test('posts/[id]/edit.tsx → "posts/[id]/edit"', () => {
        expect(filePathToRouteKey('posts/[id]/edit.tsx', ['.tsx'])).toBe(
            'posts/[id]/edit',
        )
    })

    test('files/[...rest].tsx → "files/[...rest]"', () => {
        expect(filePathToRouteKey('files/[...rest].tsx', ['.tsx'])).toBe(
            'files/[...rest]',
        )
    })

    test('Windows-style separators normalise to forward slashes', () => {
        expect(filePathToRouteKey('posts\\[id]\\edit.tsx', ['.tsx'])).toBe(
            'posts/[id]/edit',
        )
    })
})

describe('routeKeyToHonoPath', () => {
    test('index → /', () => {
        expect(routeKeyToHonoPath('index')).toBe('/')
    })

    test('posts/[id] → /posts/:id', () => {
        expect(routeKeyToHonoPath('posts/[id]')).toBe('/posts/:id')
    })

    test('files/[...rest] → /files/*', () => {
        expect(routeKeyToHonoPath('files/[...rest]')).toBe('/files/*')
    })

    test('posts/[[opt]] → /posts/:opt?', () => {
        expect(routeKeyToHonoPath('posts/[[opt]]')).toBe('/posts/:opt?')
    })
})
