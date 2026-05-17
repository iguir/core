/**
 * Tiny formatting helpers for CLI output. No deps — color via ANSI codes,
 * disabled automatically when stdout isn't a TTY or `NO_COLOR` is set.
 */

const isTty = process.stdout.isTTY === true
const enabled = isTty && !process.env.NO_COLOR

function wrap(code: number, s: string): string {
    return enabled ? `\x1b[${code}m${s}\x1b[0m` : s
}

export const c = {
    bold: (s: string) => wrap(1, s),
    dim: (s: string) => wrap(2, s),
    red: (s: string) => wrap(31, s),
    green: (s: string) => wrap(32, s),
    yellow: (s: string) => wrap(33, s),
    blue: (s: string) => wrap(34, s),
    magenta: (s: string) => wrap(35, s),
    cyan: (s: string) => wrap(36, s),
}

/** Render rows as an aligned table. Each row is an array of cells. */
export function table(rows: readonly (readonly string[])[]): string {
    if (rows.length === 0) return ''
    const cols = Math.max(...rows.map((r) => r.length))
    const widths = Array.from({ length: cols }, (_, i) =>
        Math.max(...rows.map((r) => stripAnsi(r[i] ?? '').length)),
    )
    return rows
        .map((r) =>
            r
                .map((cell, i) => {
                    if (i === r.length - 1) return cell
                    const pad = widths[i]! - stripAnsi(cell).length
                    return cell + ' '.repeat(pad + 2)
                })
                .join(''),
        )
        .join('\n')
}

function stripAnsi(s: string): string {
    return s.replace(/\x1b\[\d+m/g, '')
}
