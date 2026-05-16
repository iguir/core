/**
 * `create-iguir` — scaffolds a new @iguir/core app (colocated in
 * `src/create-app/` until monorepo split). Exposes both a CLI entrypoint
 * (`src/create-app/bin.ts`) and a programmatic one used by `app new`.
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

/** Options for `createApp()`. */
export interface CreateAppOptions {
    /** Directory to create the project in. Treated relative to `cwd`. */
    target: string
    /** Project name used in `package.json` and the README. Defaults to `basename(target)`. */
    name?: string
    /** Overwrite existing files when the target already has contents. */
    force?: boolean
    /** Pin the @iguir/core version installed in the generated package.json. */
    coreVersion?: string
}

/** Result returned by `createApp()`. */
export interface CreateAppResult {
    rootDir: string
    files: string[]
}

const TEMPLATES_DIR = resolve(import.meta.dir, 'templates')

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/

/**
 * Scaffold a new project. Returns the absolute path of the project root and
 * the list of files written.
 */
export async function createApp(opts: CreateAppOptions): Promise<CreateAppResult> {
    const rootDir = resolve(process.cwd(), opts.target)
    const name = opts.name ?? rootDir.split('/').pop()!
    if (!NAME_RE.test(name)) {
        throw new Error(
            `[create-iguir] project name "${name}" is invalid. ` +
                'Use lowercase letters, digits, hyphens, and underscores.',
        )
    }

    if (existsSync(rootDir) && (await isNonEmpty(rootDir)) && !opts.force) {
        throw new Error(
            `[create-iguir] target "${rootDir}" already exists and is not empty. ` +
                'Pass --force to overwrite.',
        )
    }

    const ctx: Ctx = {
        name,
        coreVersion: opts.coreVersion ?? '^0.0.1',
    }

    const files: string[] = []
    for (const tpl of await walkTemplates(TEMPLATES_DIR)) {
        const relPath = relative(TEMPLATES_DIR, tpl).replace(/\.tpl$/, '')
        // `_gitignore` → `.gitignore` (npm strips leading dots when packing).
        const finalRel = relPath.replace(/(^|[\\/])_gitignore$/, '$1.gitignore')
        const dest = resolve(rootDir, finalRel)
        await mkdir(dirname(dest), { recursive: true })
        const raw = await readFile(tpl, 'utf8')
        await writeFile(dest, render(raw, ctx), 'utf8')
        files.push(dest)
    }

    return { rootDir, files }
}

type Ctx = Record<string, string>

function render(tpl: string, ctx: Ctx): string {
    let out = tpl
    for (const [k, v] of Object.entries(ctx)) {
        out = out.replaceAll(`{{${k}}}`, v)
    }
    return out
}

async function isNonEmpty(dir: string): Promise<boolean> {
    try {
        const entries = await readdir(dir)
        return entries.length > 0
    } catch {
        return false
    }
}

async function walkTemplates(root: string): Promise<string[]> {
    const out: string[] = []
    async function visit(dir: string) {
        for (const entry of await readdir(dir)) {
            const full = join(dir, entry)
            const s = await stat(full)
            if (s.isDirectory()) await visit(full)
            else if (s.isFile() && entry.endsWith('.tpl')) out.push(full)
        }
    }
    await visit(root)
    return out
}
