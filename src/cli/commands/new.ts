import { defineCommand } from 'citty'
import { createApp } from '../../create-app/index'
import { c } from '../format'

export const newCommand = defineCommand({
    meta: {
        name: 'new',
        description: 'Scaffold a new @iguir/core app (alias of `create-iguir`).',
    },
    args: {
        target: {
            type: 'positional',
            required: true,
            description: 'Directory to create the project in.',
        },
        name: {
            type: 'string',
            description: 'Project name (defaults to target dir name).',
        },
        force: {
            type: 'boolean',
            description: 'Overwrite existing files if the target is non-empty.',
            default: false,
        },
        'core-version': {
            type: 'string',
            description: 'Pin a specific @iguir/core version in package.json.',
        },
    },
    async run({ args }) {
        const result = await createApp({
            target: args.target as string,
            name: args.name as string | undefined,
            force: args.force as boolean,
            coreVersion: args['core-version'] as string | undefined,
        })
        console.log(
            c.green(`✓ Scaffolded ${result.files.length} files in `) +
                c.cyan(result.rootDir),
        )
        console.log(c.dim('\nNext:'))
        console.log(`  ${c.dim('$')} cd ${args.target}`)
        console.log(`  ${c.dim('$')} bun install`)
        console.log(`  ${c.dim('$')} bun dev`)
    },
})
