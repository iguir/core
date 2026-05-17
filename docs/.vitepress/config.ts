import { defineConfig } from 'vitepress'

export default defineConfig({
    title: '@iguir/core',
    description: 'A Hono-based meta-framework for Bun.',
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: ['**/.archive/**'],
    // GitHub Pages hosts at <user>.github.io/<repo>, so set the base path.
    // Override via VITEPRESS_BASE env when serving from a custom domain.
    base: process.env.VITEPRESS_BASE ?? '/core/',

    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/install' },
            { text: 'GitHub', link: 'https://github.com/iguir/core' },
        ],
        sidebar: {
            '/guide/': [
                {
                    text: 'Getting started',
                    items: [
                        { text: 'Install', link: '/guide/install' },
                        { text: 'Quick start', link: '/guide/quick-start' },
                    ],
                },
                {
                    text: 'Core concepts',
                    items: [
                        { text: 'Modules & contracts', link: '/guide/modules' },
                        { text: 'Routing & validation', link: '/guide/routing' },
                        { text: 'ACL & permissions', link: '/guide/acl' },
                        { text: 'Events', link: '/guide/events' },
                    ],
                },
                {
                    text: 'Frontend',
                    items: [
                        { text: 'JSX, pages & islands', link: '/guide/jsx' },
                    ],
                },
                {
                    text: 'Built-in modules',
                    items: [
                        { text: 'Auth', link: '/guide/auth' },
                        { text: 'Database (Drizzle)', link: '/guide/db' },
                    ],
                },
                {
                    text: 'Toolchain',
                    items: [
                        { text: 'CLI (iguir)', link: '/guide/cli' },
                        { text: 'Testing', link: '/guide/testing' },
                    ],
                },
            ],
        },
        socialLinks: [
            { icon: 'github', link: 'https://github.com/iguir/core' },
        ],
        editLink: {
            pattern: 'https://github.com/iguir/core/edit/main/docs/:path',
        },
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026 iguir contributors',
        },
    },
})
