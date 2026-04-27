# e2e-compliance

End-to-end Playwright tests for the compliance app, run against a real backend.

## Prerequisites

Both servers must be running. The API must be started with
`ENABLE_TEST_HOOKS=true` so the per-spec reset endpoint is mounted:

```bash
ENABLE_TEST_HOOKS=true pnpm --filter @apps/compliance dev   # API on :3012
pnpm --filter @apps/compliance-web dev                       # Web on :5176
```

The compliance demo seed must be loaded once:

```bash
pnpm --filter @apps/compliance db:seed -- --kind=system
pnpm --filter @apps/compliance db:seed -- --kind=demo
```

If `ENABLE_TEST_HOOKS` is unset, `POST /admin/test/reset` is not
registered and the `resetState` helper will fail with 404 — specs
assume a clean DB at the start of each spec.

## Run

From repo root:

```bash
pnpm exec playwright test --config e2e-compliance/playwright.config.ts
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
