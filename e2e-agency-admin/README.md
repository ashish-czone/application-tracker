# e2e-agency-admin

End-to-end Playwright tests for the agency app's **admin** portal, run against a real backend.

Currently exercises the projects domain — dashboard, detail page, and the My Tasks view.

## Prerequisites

Both servers must be running. The API must be started with
`ENABLE_TEST_HOOKS=true` so the per-spec reset endpoint is mounted:

```bash
ENABLE_TEST_HOOKS=true pnpm --filter @apps/agency dev          # API on :3014
pnpm --filter @apps/agency-admin dev                            # Admin web on :5177
```

The agency system + e2e-admin seeds must be loaded once:

```bash
pnpm --filter @apps/agency db:seed -- --kind=system
```

The e2e-admin user is created by the system seed pipeline (its dedicated
seed source is registered in `domains/agency/api/seeds.ts`) and gets a
super-admin role, so it can hit every projects endpoint.

If `ENABLE_TEST_HOOKS` is unset, `POST /admin/test/reset` is not
registered and the `resetState` helper will fail with 404.

## Run

From repo root:

```bash
pnpm exec playwright test --config e2e-agency-admin/playwright.config.ts
```

To run a single spec:

```bash
pnpm exec playwright test --config e2e-agency-admin/playwright.config.ts e2e-agency-admin/projects.spec.ts
```

## Configuration

Override defaults via environment:

| Variable | Default | Purpose |
|---|---|---|
| `E2E_WEB_URL` | `http://localhost:5177` | Agency admin web app URL |
| `E2E_API_URL` | `http://localhost:3014` | Agency API URL |
| `E2E_ADMIN_EMAIL` | `e2e-admin@agency.test` | Test admin login |
| `E2E_ADMIN_PASSWORD` | `E2eAdmin1234` | Test admin password |

## State isolation

Specs reset the database to a known clean state via `resetState()`,
typically from `test.beforeAll` (per spec file). The reset endpoint
truncates every data table and reruns the system seeds plus the
e2e-admin demo seed; **projects demo data is NOT re-seeded**, so each
spec starts from zero projects.

The `e2e-admin@agency.test` user has a pinned id so the JWT minted in
`global-setup.ts` remains valid across resets.

## Pattern

Drive setup via the `apiClient` helper (faster + deterministic), drive
the behavior under test via the UI. The `buildProjectTree` helper in
`projects.spec.ts` shows the canonical setup shape: create project →
milestone → feature → tasks, optionally transitioning some tasks to
`done` for rollup verification.
