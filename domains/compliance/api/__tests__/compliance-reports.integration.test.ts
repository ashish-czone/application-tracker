import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp } from './setup/app';

// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read report endpoints whose only `@RequirePermission` is `reports.read`.
const NO_PERMS: string[] = [];

const REPORT_PATHS = [
  '/api/v1/compliance-reports/trend',
  '/api/v1/compliance-reports/by-client',
  '/api/v1/compliance-reports/aging',
  '/api/v1/compliance-reports/severity',
  '/api/v1/compliance-reports/team-workload',
] as const;

/**
 * Auth-only coverage for the compliance-reports endpoints. Positive-path
 * coverage for the aggregation SQL itself lives in the rollup/reports
 * service unit suite (PR #1223). This file pins 401 (anon) + 403
 * (insufficient perm) on every endpoint per the PROMPT-API.md security-test
 * mandate.
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
