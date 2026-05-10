# Contributing

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/).

Format: `type(scope): subject`

Examples:
- `feat(router): add trailing slash option`
- `fix(middleware): handle empty body in cors`
- `docs(readme): add bun installation guide`
- `chore(deps): bump typescript to 5.6`

Run `bun run commit` for an interactive prompt.

## Releasing

When you make a user-facing change, run:

\`\`\`bash
bunx changeset
\`\`\`

…and commit the generated file with your PR.

## Setup

\`\`\`bash
bun install
bun test
\`\`\`