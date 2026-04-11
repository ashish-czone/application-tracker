## Pre-Commit Verification

Before every commit, run these three checks. All must pass. Do not commit if any fail — fix the issue first.

### 1. Unit tests for modified packages

Run unit tests for every `packages/*` package that has changed files in the current diff:

```bash
# Identify changed packages and run their tests
pnpm --filter @packages/<changed-package> test
```

Run tests for **each** modified package individually. If a package has no `test` script, skip it. If tests fail, fix before committing.

### 2. App builds

Both apps must build successfully:

```bash
pnpm --filter @apps/recruit build
pnpm --filter @apps/recruit-web build
```

Build failures indicate broken imports, type errors, or missing exports. Fix before committing.

### 3. Dependency boundary lint

Verify no cross-package dependency violations were introduced. Run from the repo root:

```bash
pnpm lint
```

This runs ESLint across the workspace. Additionally, manually verify:
- **No addon → addon imports** — grep your changed files for imports from `@packages/addons/*` inside other addon packages
- **No package → app imports** — packages must never import from `apps/*`
- **No frontend → backend imports** — `apps/recruit-web` and `*-ui` packages must not import backend modules

If lint or boundary checks fail, fix the import before committing.

### Execution

Run all three in parallel where possible. The unit tests and builds are independent and can run concurrently. If any check fails, stop and fix before retrying the commit.
