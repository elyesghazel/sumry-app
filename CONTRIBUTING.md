# Contributing

Issues and pull requests are welcome. For anything bigger than a fix, open an issue first so
we can agree on the approach.

## Setup and checks

See [Development](README.md#development). Before a pull request:

```bash
npm run typecheck
npm run check-core
```

`src/core/` is generated from `core/` in [sumry-frontend](https://github.com/elyesghazel/sumry-frontend)
by its `scripts/sync-core.sh`. Change shared logic there, then sync it here; `check-core`
fails when the copy has drifted. Add a screenshot to the pull request for anything you can
see.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), subject line only:

```
feat(entry): add a transfer shortcut
fix(sign-in): keep the server after a failed login
docs(readme): document the apk install
```

- Types: `feat` `fix` `refactor` `perf` `docs` `style` `test` `build` `ci` `chore` `revert`.
- Scope is the area you touched. Imperative, lowercase, no trailing period.
- One logical change per commit. A body only to explain a why the diff cannot show.
- Pull request titles follow the same rules.

## Style

Hyphens, not em dashes, in docs and UI text. Keep the tone plain.

## Contributor license agreement

Sumry is AGPL-3.0, and Elyes Ghazel wants to keep the option of changing the license later
(for example to a more permissive one, or dual licensing). That needs the right to relicense
every contribution, so pull requests are accepted under these terms:

1. You wrote the contribution, or otherwise have the right to submit it.
2. You license it under the AGPL-3.0, like the rest of the project.
3. You also grant Elyes Ghazel a perpetual, worldwide, non-exclusive, royalty-free and
   irrevocable right to use, modify, sublicense and relicense the contribution under other
   terms.
4. You keep the copyright to your contribution.

Tick the box in the pull request template to agree. Without it the pull request cannot be
merged.
