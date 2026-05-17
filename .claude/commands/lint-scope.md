---
description: Validate a proposed commit subject against the scope-enum in commitlint.config.mjs.
argument-hint: <commit subject like "feat(acl): add middleware">
---

Given the commit subject `$ARGUMENTS`:

1. Read `commitlint.config.mjs` and extract the allowed `type-enum` and `scope-enum` arrays.
2. Parse the subject into `type(scope): description`.
3. Report:
   - Whether the type is allowed.
   - Whether the scope is allowed.
   - Whether the description is lowercase and missing a trailing period.
   - Whether the header length ≤ 100.
4. If the scope is rejected, suggest the closest match (Levenshtein-style) from the enum.

Do NOT run `git commit`. This is a pre-flight check only.
