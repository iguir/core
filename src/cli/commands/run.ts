import { defineCommand } from 'citty'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveAppConfig } from '../resolve-config'
import { c } from '../format'

const VITE_CONFIG_CANDIDATES = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']

function findViteConfig(rootDir: string): string | null {
    for (const name of VITE_CONFIG_CANDIDATES) {
        const p = resolve(rootDir, name)
        if (existsSync(p)) return p
    }
    return null
}

/**
 * Locate the user's server entrypoint. Convention is `src/main.ts`; we walk
 * a small list of fallbacks before giving up so generated apps and one-off
 * scripts both work.
 */
async function findEntry(
    rootDir: string,
    explicit: string | undefined,
): Promise<string> {
    if (explicit) {
        const file = resolve(rootDir, explicit)
        if (!existsSync(file)) {
            throw new Error(`[cli] entrypoint does not exist: ${file}`)
        }
        return file
    }
    const candidates = ['src/main.ts', 'src/server.ts', 'src/index.ts', 'main.ts']
    for (const rel of candidates) {
        const abs = resolve(rootDir, rel)
        if (existsSync(abs)) return abs
    }
    throw new Error(
        `[cli] could not find a server entrypoint in ${rootDir}. ` +
            `Tried: ${candidates.join(', ')}. Use --entry <path> to override.`,
    )
}

async function spawnBun(args: string[], cwd: string): Promise<never> {
    const proc = Bun.spawn(['bun', ...args], {
        cwd,
        stdio: ['inherit', 'inherit', 'inherit'],
    })
    const code = await proc.exited
    process.exit(code)
}

/**
 * Spawn the Bun server + Vite client side-by-side. Used by `iguir dev` when
 * a `vite.config.ts` is present. Kills both children when either exits and
 * forwards the non-zero exit code.
 */
async function spawnDevPair(
    bunArgs: string[],
    viteArgs: string[],
    cwd: string,
): Promise<never> {
    const bun = Bun.spawn(['bun', ...bunArgs], {
        cwd,
        stdio: ['inherit', 'inherit', 'inherit'],
    })
    const vite = Bun.spawn(['bunx', 'vite', ...viteArgs], {
        cwd,
        stdio: ['inherit', 'inherit', 'inherit'],
    })

    const cleanup = () => {
        if (!bun.killed) bun.kill()
        if (!vite.killed) vite.kill()
    }
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    const winner = await Promise.race([
        bun.exited.then((code) => ({ who: 'bun' as const, code })),
        vite.exited.then((code) => ({ who: 'vite' as const, code })),
    ])
    cleanup()
    // Drain the other child so we don't leak file descriptors.
    await Promise.all([bun.exited, vite.exited]).catch(() => {})
    process.exit(winner.code ?? 0)
}

export const devCommand = defineCommand({
    meta: {
        name: 'dev',
        description: 'Run the app with `bun --hot <entry>` (auto-reload on change).',
    },
    args: {
        config: { type: 'string', description: 'Path to app.config.ts.' },
        entry: { type: 'string', description: 'Override the server entrypoint.' },
        'no-vite': {
            type: 'boolean',
            description: 'Skip launching Vite even if vite.config.ts is present.',
            default: false,
        },
    },
    async run({ args }) {
        const { rootDir } = await resolveAppConfig({ explicit: args.config })
        const entry = await findEntry(rootDir, args.entry as string | undefined)
        const viteCfg = findViteConfig(rootDir)

        if (viteCfg && !args['no-vite']) {
            console.log(
                c.dim(`Starting dev server: `) +
                    c.cyan(entry) +
                    c.dim(` + vite (${viteCfg.split('/').pop()})`),
            )
            await spawnDevPair(['--hot', entry], [], rootDir)
        } else {
            console.log(c.dim(`Starting dev server: `) + c.cyan(entry))
            await spawnBun(['--hot', entry], rootDir)
        }
    },
})

export const startCommand = defineCommand({
    meta: {
        name: 'start',
        description: 'Run the app in production mode (no --hot).',
    },
    args: {
        config: { type: 'string', description: 'Path to app.config.ts.' },
        entry: { type: 'string', description: 'Override the server entrypoint.' },
    },
    async run({ args }) {
        const { rootDir } = await resolveAppConfig({ explicit: args.config })
        const entry = await findEntry(rootDir, args.entry as string | undefined)
        await spawnBun([entry], rootDir)
    },
})

export const buildCommand = defineCommand({
    meta: {
        name: 'build',
        description:
            'Build the server with `bun build` and the client with `vite build` when vite.config.ts is present.',
    },
    args: {
        config: { type: 'string', description: 'Path to app.config.ts.' },
        entry: { type: 'string', description: 'Override the server entrypoint.' },
        outdir: {
            type: 'string',
            description: 'Output directory.',
            default: 'dist',
        },
        minify: { type: 'boolean', description: 'Minify the output.', default: false },
        sourcemap: {
            type: 'boolean',
            description: 'Emit a sourcemap.',
            default: true,
        },
    },
    async run({ args }) {
        const { rootDir } = await resolveAppConfig({ explicit: args.config })
        const entry = await findEntry(rootDir, args.entry as string | undefined)
        const outdir = resolve(rootDir, args.outdir as string)

        const buildArgs = [
            'build',
            entry,
            '--target=bun',
            `--outdir=${outdir}`,
        ]
        if (args.minify) buildArgs.push('--minify')
        if (args.sourcemap) buildArgs.push('--sourcemap')

        const viteCfg = findViteConfig(rootDir)
        if (viteCfg) {
            console.log(c.dim(`Building client bundle (vite)…`))
            const viteProc = Bun.spawn(['bunx', 'vite', 'build'], {
                cwd: rootDir,
                stdio: ['inherit', 'inherit', 'inherit'],
            })
            const viteCode = await viteProc.exited
            if (viteCode !== 0) process.exit(viteCode)
            console.log(c.green('✓ Client bundle built.'))
        }

        console.log(c.dim(`Building server bundle: `) + c.cyan(entry))
        const proc = Bun.spawn(['bun', ...buildArgs], {
            cwd: rootDir,
            stdio: ['inherit', 'inherit', 'inherit'],
        })
        const code = await proc.exited
        if (code !== 0) process.exit(code)
        console.log(c.green(`✓ Server bundle written to ${outdir}`))
    },
})

export const testCommand = defineCommand({
    meta: {
        name: 'test',
        description: 'Run `bun test` in the app directory (extra args passed through).',
    },
    args: {
        config: { type: 'string', description: 'Path to app.config.ts.' },
        '_': { type: 'positional', required: false },
    },
    async run({ args, rawArgs }) {
        const { rootDir } = await resolveAppConfig({ explicit: args.config })
        // Pass through every arg after `test` verbatim.
        const idx = rawArgs.indexOf('test')
        const passthrough = idx >= 0 ? rawArgs.slice(idx + 1) : []
        // Strip the `--config <x>` pair so it doesn't reach `bun test`.
        const filtered = stripConfigArg(passthrough)
        await spawnBun(['test', ...filtered], rootDir)
    },
})

function stripConfigArg(args: readonly string[]): string[] {
    const out: string[] = []
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--config') {
            i++ // skip value
            continue
        }
        if (args[i]?.startsWith('--config=')) continue
        out.push(args[i]!)
    }
    return out
}
