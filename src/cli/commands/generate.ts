import { defineCommand } from 'citty'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve, dirname } from 'node:path'
import { resolveAppConfig } from '../resolve-config'
import { c } from '../format'

const MODULE_NAME_RE = /^[a-z][a-z0-9_]*$/

/** Available features when scaffolding a module. */
const ALL_FEATURES = ['routes', 'contract', 'acl', 'events', 'services', 'tests'] as const
type Feature = (typeof ALL_FEATURES)[number]

const DEFAULT_FEATURES: readonly Feature[] = [
    'routes',
    'contract',
    'acl',
    'services',
    'tests',
]

const TEMPLATES_DIR = resolve(import.meta.dir, '..', 'templates', 'module')

export const generateCommand = defineCommand({
    meta: {
        name: 'generate',
        description: 'Scaffold framework primitives (modules, etc.).',
    },
    subCommands: {
        module: defineCommand({
            meta: {
                name: 'module',
                description: 'Scaffold a new module under src/modules/<name>/.',
            },
            args: {
                name: { type: 'positional', required: true, description: 'Module name (lowercase, snake_case).' },
                config: { type: 'string', description: 'Path to app.config.ts.' },
                with: {
                    type: 'string',
                    description: `Comma-separated features to include. Default: ${DEFAULT_FEATURES.join(',')}. Available: ${ALL_FEATURES.join(',')}.`,
                },
                force: {
                    type: 'boolean',
                    description: 'Overwrite existing files instead of failing.',
                    default: false,
                },
            },
            async run({ args }) {
                const name = args.name as string
                if (!MODULE_NAME_RE.test(name)) {
                    console.error(
                        c.red(
                            `[cli] module name "${name}" is invalid. ` +
                                'Use lowercase letters, digits, and underscores; must start with a letter.',
                        ),
                    )
                    process.exit(1)
                }

                const features = parseFeatures(args.with as string | undefined)
                const { rootDir } = await resolveAppConfig({
                    explicit: args.config as string | undefined,
                })

                const moduleDir = resolve(rootDir, 'src', 'modules', name)
                if (existsSync(moduleDir) && !args.force) {
                    console.error(
                        c.red(`[cli] ${relative(rootDir, moduleDir)} already exists. ` +
                            'Pass --force to overwrite.'),
                    )
                    process.exit(1)
                }

                const written = await scaffoldModule({
                    name,
                    features,
                    moduleDir,
                    force: args.force as boolean,
                })

                console.log(
                    c.green(`✓ Generated module `) + c.cyan(name) + c.green(':'),
                )
                for (const file of written) {
                    console.log(`  ${c.dim('+')} ${relative(rootDir, file)}`)
                }
                console.log(
                    c.dim(
                        `\nNext: add \`${camelize(name)}Module\` to \`modules: [...]\` in app.config.ts.`,
                    ),
                )
            },
        }),
    },
})

interface ScaffoldOptions {
    name: string
    features: readonly Feature[]
    moduleDir: string
    force: boolean
}

async function scaffoldModule(opts: ScaffoldOptions): Promise<string[]> {
    const { name, features, moduleDir, force } = opts
    const ctx = templateContext(name, features)
    const written: string[] = []

    await mkdir(moduleDir, { recursive: true })

    const wantContract = features.includes('contract')
    const wantAcl = features.includes('acl')
    const wantEvents = features.includes('events')
    const wantRoutes = features.includes('routes')
    const wantServices = features.includes('services')
    const wantTests = features.includes('tests')

    if (wantContract) {
        written.push(
            await write(join(moduleDir, `${name}.contract.ts`), 'contract.ts.tpl', ctx, force),
        )
    }
    if (wantAcl) {
        written.push(
            await write(join(moduleDir, `${name}.acl.ts`), 'acl.ts.tpl', ctx, force),
        )
    }
    if (wantEvents) {
        written.push(
            await write(join(moduleDir, 'events.ts'), 'events.ts.tpl', ctx, force),
        )
    }
    if (wantRoutes) {
        written.push(
            await write(
                join(moduleDir, 'routes', 'api.ts'),
                'routes/api.ts.tpl',
                ctx,
                force,
            ),
        )
    }
    if (wantServices) {
        written.push(
            await write(
                join(moduleDir, 'services', 'index.ts'),
                'services/index.ts.tpl',
                ctx,
                force,
            ),
        )
    }
    if (wantTests) {
        written.push(
            await write(
                join(moduleDir, 'tests', `${name}.test.ts`),
                'tests/{{name}}.test.ts.tpl',
                ctx,
                force,
            ),
        )
    }

    // Module file last — fields depend on which features were enabled.
    const moduleFields = buildModuleFields(name, ctx, {
        wantAcl,
        wantEvents,
        wantRoutes,
        wantContract,
    })
    const imports = buildModuleImports(name, {
        wantAcl,
        wantEvents,
        wantRoutes,
        wantContract,
    })
    written.push(
        await write(
            join(moduleDir, `${name}.module.ts`),
            'module.ts.tpl',
            { ...ctx, ...imports, moduleFields },
            force,
        ),
    )

    return written
}

type Ctx = Record<string, string>

function templateContext(name: string, _features: readonly Feature[]): Ctx {
    return {
        name,
        nameCamel: camelize(name),
        NameTitle: titleCase(name),
    }
}

function buildModuleFields(
    name: string,
    ctx: Ctx,
    flags: {
        wantAcl: boolean
        wantEvents: boolean
        wantRoutes: boolean
        wantContract: boolean
    },
): string {
    const lines: string[] = []
    if (flags.wantAcl) lines.push(`    acl: ${ctx.nameCamel}Acl,`)
    if (flags.wantEvents) lines.push(`    events: ${ctx.nameCamel}Events,`)
    if (flags.wantContract) {
        lines.push(`    provides: ${ctx.nameCamel}Contract,`)
        lines.push(
            `    implementation: () => ({ /* TODO: implement ${ctx.nameCamel}Contract methods */ }),`,
        )
    }
    if (flags.wantRoutes) {
        lines.push(`    routes: { handler: apiRoutes, prefix: '/api/${name}' },`)
    }
    return lines.join('\n') + (lines.length > 0 ? '\n' : '')
}

function buildModuleImports(
    name: string,
    flags: {
        wantAcl: boolean
        wantEvents: boolean
        wantRoutes: boolean
        wantContract: boolean
    },
): Record<string, string> {
    const camel = camelize(name)
    return {
        aclImport: flags.wantAcl
            ? `import { ${camel}Acl } from './${name}.acl'\n`
            : '',
        contractImport: flags.wantContract
            ? `import { ${camel}Contract } from './${name}.contract'\n`
            : '',
        eventsImport: flags.wantEvents
            ? `import { ${camel}Events } from './events'\n`
            : '',
        routesImport: flags.wantRoutes
            ? `import { apiRoutes } from './routes/api'\n`
            : '',
    }
}

async function write(
    dest: string,
    templateRel: string,
    ctx: Ctx,
    force: boolean,
): Promise<string> {
    if (existsSync(dest) && !force) {
        throw new Error(
            `[cli] refuse to overwrite existing file ${dest}. Pass --force to override.`,
        )
    }
    await mkdir(dirname(dest), { recursive: true })
    const tpl = await readFile(join(TEMPLATES_DIR, templateRel), 'utf8')
    await writeFile(dest, render(tpl, ctx), 'utf8')
    return dest
}

function render(tpl: string, ctx: Ctx): string {
    let out = tpl
    for (const [k, v] of Object.entries(ctx)) {
        out = out.replaceAll(`{{${k}}}`, v)
    }
    return out
}

function parseFeatures(input: string | undefined): readonly Feature[] {
    if (!input) return DEFAULT_FEATURES
    const requested = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as Feature[]
    for (const f of requested) {
        if (!ALL_FEATURES.includes(f)) {
            console.error(
                c.red(`[cli] unknown feature "${f}". `) +
                    c.dim(`Known: ${ALL_FEATURES.join(', ')}.`),
            )
            process.exit(1)
        }
    }
    return requested
}

function camelize(name: string): string {
    return name.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
}

function titleCase(name: string): string {
    const camel = camelize(name)
    return camel.charAt(0).toUpperCase() + camel.slice(1)
}

// Currently unused helpers kept exported for future commands.
export async function listDir(dir: string): Promise<string[]> {
    const entries = await readdir(dir)
    const files: string[] = []
    for (const e of entries) {
        const s = await stat(join(dir, e))
        if (s.isFile()) files.push(e)
    }
    return files
}
