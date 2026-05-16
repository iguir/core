#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { aclCommand } from './commands/acl'
import { generateCommand } from './commands/generate'
import { openapiCommand } from './commands/openapi'
import { routesCommand } from './commands/routes'
import {
    buildCommand,
    devCommand,
    startCommand,
    testCommand,
} from './commands/run'

const main = defineCommand({
    meta: {
        name: 'app',
        version: '0.0.1',
        description: '@iguir/core — Hono-based meta-framework for Bun.',
    },
    subCommands: {
        routes: routesCommand,
        acl: aclCommand,
        openapi: openapiCommand,
        dev: devCommand,
        start: startCommand,
        build: buildCommand,
        test: testCommand,
        generate: generateCommand,
    },
})

await runMain(main)
