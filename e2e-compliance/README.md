# e2e-compliance

End-to-end Playwright tests for the compliance app, run against a real backend.

## Prerequisites

Both servers must be running:

```bash
pnpm --filter @apps/compliance dev          # API on :3012
pnpm --filter @apps/compliance-web dev      # Web on :5176
```

The compliance demo seed must be loaded:

```bash
pnpm --filter @apps/compliance db:seed -- --kind=system
pnpm --filter @apps/compliance db:seed -- --kind=demo
```

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

Tests create entities with UUID-suffixed names (`E2E_${nanoid()}_Client`) and clean
them up via API in `afterAll`. Demo seed data is never modified.

The dedicated `e2e-admin@compliance.test` user is created by the
`@domains/compliance-api/demo-e2e-admin` demo seed.
