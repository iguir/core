#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { createApp } from './index'

const main = defineCommand({
    meta: {
        name: 'create-iguir',
        description: 'Scaffold a new @iguir/core app.',
        version: '0.0.1',
    },
    args: {
        target: {
            type: 'positional',
            required: true,
            description: 'Directory to create the project in.',
        },
        name: {
            type: 'string',
            description: 'Project name (defaults to the target directory name).',
        },
        force: {
            type: 'boolean',
            description: 'Overwrite existing files if the target is non-empty.',
            default: false,
        },
        'core-version': {
            type: 'string',
            description: 'Pin a specific @iguir/core version.',
        },
    },
    async run({ args }) {
        const result = await createApp({
            target: args.target as string,
            name: args.name as string | undefined,
            force: args.force as boolean,
            coreVersion: args['core-version'] as string | undefined,
        })
        console.log(`✓ Scaffolded ${result.files.length} files in ${result.rootDir}`)
        console.log('\nNext:')
        console.log(`  cd ${args.target}`)
        console.log('  bun install')
        console.log('  bun dev')
    },
})

await runMain(main)
