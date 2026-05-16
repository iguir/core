#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { aclCommand } from './commands/acl'
import { generateCommand } from './commands/generate'
import { newCommand } from './commands/new'
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
        name: 'iguir',
        version: '0.0.1',
        description: '@iguir/core — Hono-based meta-framework for Bun.',
    },
    subCommands: {
        new: newCommand,
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
