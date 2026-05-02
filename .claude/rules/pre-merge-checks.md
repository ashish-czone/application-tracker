## Pre-Merge Verification

Run these three checks **once** before merging a feature PR into `main`. All must pass. Do not merge if any fail — fix the issue, push the fix, then merge.

Do NOT run these before every commit. Inside a feature flow, the implementation → test → commit loop only runs the tests directly relevant to what just changed (e.g. the one package's unit tests for a task that had logic). The full suite below is the pre-merge gate, not a per-commit gate.

### 1. Unit tests for modified packages

Run unit tests for every `packages/*` package that has changed files in the PR diff:

```bash
# Identify changed packages and run their tests
pnpm --filter @packages/<changed-package> test
```

Run tests for **each** modified package individually. If a package has no `test` script, skip it. If tests fail, fix before merging.

### 2. App builds

Both apps must build successfully:

```bash
pnpm --filter @apps/recruit build
pnpm --filter @apps/recruit-web build
```

Build failures indicate broken imports, type errors, or missing exports. Fix before merging.

### 3. Lint pipeline

Verify no cross-package dependency violations or data-scoping drift were introduced. Run from the repo root:

```bash
pnpm lint
```

This runs two checks:

- `pnpm lint:boundaries` — ESLint dependency-direction rules across the workspace.
- `pnpm lint:scoping` — structural check that every service file with raw `db.select/update/delete/execute` chains imports a scope primitive (`withScope`, `BaseCrudService`, `buildPredicate`, …). Grandfathered offenders are listed in `tools/data-access-scope-allowlist.txt` and exempted; new code cannot add to that file. See `.claude/rules/data-scoping.md` and `.claude/rules/data-access-scope.md`.

Additionally, manually verify:
- **No addon → addon imports** — grep the PR diff for imports from `@packages/addons/*` inside other addon packages
- **No package → app imports** — packages must never import from `apps/*`
- **No frontend → backend imports** — `apps/recruit-web` and `*-ui` packages must not import backend modules

If any lint check fails, fix the issue before merging. For `lint:scoping` failures, the script prints the file paths and the fix instructions.

### Execution

Run all three in parallel where possible. The unit tests and builds are independent and can run concurrently. If any check fails, stop and fix before retrying the merge.
