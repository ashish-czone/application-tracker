import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp } from './setup/app';

// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read report endpoints whose only `@RequirePermission` is `reports.read`.
const NO_PERMS: string[] = [];

const REPORT_PATHS = [
  '/api/v1/compliance-filings/reports/trend',
  '/api/v1/compliance-filings/reports/by-client',
  '/api/v1/compliance-filings/reports/aging',
  '/api/v1/compliance-filings/reports/severity',
  '/api/v1/org-units/reports/team-workload',
] as const;

/**
 * Auth-only coverage for the report endpoints. Positive-path coverage for
 * the aggregation SQL itself lives in the rollup/reports service unit
 * suite. This file pins 401 (anon) + 403 (insufficient perm) on every
 * endpoint per the PROMPT-API.md security-test mandate.
 *
 * After the per-module reports decomposition, the 4 single-domain reports
 * live under /compliance-filings/reports/* and team-workload (the one
 * cross-domain report) lives under /org-units/reports/* — owned by the
 * app's OrgUnitsModule composition layer.
 */
describe('Compliance Reports auth (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createComplianceTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  for (const path of REPORT_PATHS) {
    describe(`GET ${path}`, () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get(path).expect(401);
      });

      it('returns 403 without reports.read', async () => {
        await request(ctx.httpServer).get(path).set(withAuth(NO_PERMS)).expect(403);
      });
    });
  }
});
