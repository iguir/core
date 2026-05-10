export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'core',         // main framework / app instance
        'router',       // routing logic
        'middleware',   // built-in middlewares
        'helper',       // helper functions
        'context',      // request/response context
        'adapter',      // bun/node/deno/workers adapters
        'types',        // type-only changes
        'deps',         // dependency bumps
        'release',      // release commits
        // add more as the framework grows
      ],
    ],
    'scope-empty': [2, 'never'],          // force a scope
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],          // disable, breaks long URLs in bodies
  },
};