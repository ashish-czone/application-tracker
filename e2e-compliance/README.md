# e2e-compliance

End-to-end Playwright tests for the compliance app, run against a real backend.

## Prerequisites

A migrated compliance database with the system seed and the e2e-admin
demo seed loaded. One-time setup:

```bash
pnpm --filter @apps/compliance db:migrate
pnpm --filter @apps/compliance db:seed:system
pnpm --filter @apps/compliance db:seed:demo
```

Specs reset the database between groups via `POST /admin/test/reset` —
the reset endpoint truncates every data table and reruns the seeds, so
the seeds above only need to land once. Migrations are not re-applied on
reset, so re-run `db:migrate` after schema changes.

## Run

From repo root:

```bash
pnpm exec playwright test --config e2e-compliance/playwright.config.ts
```

The Playwright config owns the API + web server lifecycle, so a single
invocation is enough — no manual pre-boot, no env flag to remember. With
`reuseExistingServer: true` (off-CI), specs reuse a server already
listening on `:3012` / `:5176` if you've started one for fast iteration:

```bash
pnpm --filter @apps/compliance dev:e2e   # API with ENABLE_TEST_HOOKS=true
pnpm --filter @apps/compliance-web dev   # Web on :5176
```

To run a single spec:

```bash
pnpm exec playwright test --config e2e-compliance/playwright.config.ts e2e-compliance/smoke.spec.ts
```

## Configuration

Override defaults via environment:

| Variable | Default | Purpose |
|---|---|---|
| `E2E_WEB_URL` | `http://localhost:5176` | Compliance web app URL |
| `E2E_API_URL` | `http://localhost:3012` | Compliance API URL |
| `E2E_ADMIN_EMAIL` | `e2e-admin@compliance.test` | Test admin login |
| `E2E_ADMIN_PASSWORD` | `E2eAdmin1234` | Test admin password |

## State isolation

Specs reset the database to a known clean state via `resetState()`
from `./helpers/`, typically from `test.beforeAll` (per spec file).
The reset endpoint truncates every data table and reruns the system
seeds plus the e2e-admin demo seed; migration tables are preserved.

For specs whose tests mutually interfere (rare — typically those that
mutate seeded role permissions or workflow definitions), call
`resetState()` from `test.beforeEach` instead.

The `e2e-admin@compliance.test` user has a pinned id
(`e2ea0000-0000-4000-8000-000000000000`) so the JWT minted in
`global-setup.ts` remains valid across resets.
