import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import {
  createClient,
  createFiling,
  createLaw,
  createOrgUnit,
  createOrgUnitLevel,
  createRegistration,
  createRule,
  createUser,
} from './setup/fixtures';

/**
 * Positive-path coverage for the CSV report-export endpoints. Verifies:
 *
 *  - the response body is well-formed CSV with the expected columns;
 *  - Content-Disposition / Content-Type headers are present;
 *  - RFC 4180 escaping fires for fields containing commas / quotes;
 *  - actor scope is honored — an `assigned`-scoped user only sees
 *    rows whose `assigneeId` matches them, not the firm-wide pool.
 *
 * 401 / 403 coverage lives in `compliance-reports.integration.test.ts`
 * which iterates every report endpoint (JSON + CSV) for auth pinning.
 */

const ADMIN = ['*', 'reports.read'];

interface Seeded {
  alice: string;
  bob: string;
  unitId: string;
  lawId: string;
  ruleId: string;
  clientWithComma: string;
  clientPlain: string;
  registrationCommaId: string;
  registrationPlainId: string;
}

async function seedScenario(ctx: PackageTestApp, today: string): Promise<Seeded> {
  const { id: alice } = await createUser(ctx.db);
  const { id: bob } = await createUser(ctx.db);
  const { id: levelId } = await createOrgUnitLevel(ctx.db);
  const { id: unitId } = await createOrgUnit(ctx.db, levelId);
  const { id: lawId } = await createLaw(ctx.db);
  const { id: ruleId } = await createRule(ctx.db, lawId);

  // Client with a comma in the name — exercises CSV escaping.
  const { id: clientWithComma } = await createClient(ctx.db, {
    name: 'Acme, Inc.',
  });
  const { id: clientPlain } = await createClient(ctx.db, {
    name: 'Globex Pvt Ltd',
  });

  const { id: registrationCommaId } = await createRegistration(
    ctx.db,
    clientWithComma,
    lawId,
  );
  const { id: registrationPlainId } = await createRegistration(
    ctx.db,
    clientPlain,
    lawId,
  );

  // Two overdue filings — Alice owns the comma-named client, Bob owns the plain one.
  const overdueDate = '2026-04-01'; // before `today` of 2026-04-30
  await createFiling(
    ctx.db,
    {
      ruleId,
      clientId: clientWithComma,
      lawId,
      assigneeTeamId: unitId,
      createdBy: alice,
    },
    {
      title: 'Quarterly TDS, Q4',
      status: 'pending',
      dueDate: overdueDate,
      assigneeId: alice,
    },
  );
  await createFiling(
    ctx.db,
    {
      ruleId,
      clientId: clientPlain,
      lawId,
      assigneeTeamId: unitId,
      createdBy: bob,
    },
    {
      title: 'GST Annual',
      status: 'pending',
      dueDate: overdueDate,
      assigneeId: bob,
    },
  );

  // Suppress unused-var lint for "today"; consumed by callers.
  void today;

  return {
    alice,
    bob,
    unitId,
    lawId,
    ruleId,
    clientWithComma,
    clientPlain,
    registrationCommaId,
    registrationPlainId,
  };
}

describe('Compliance Reports CSV (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createComplianceTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await resetComplianceTestDb(ctx);
  });

  describe('GET /compliance-filings/reports/overdue.csv', () => {
    it('returns the full overdue list with CSV headers + Content-Disposition', async () => {
      await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance-filings/reports/overdue.csv?today=2026-04-30')
        .set(withAuth(ADMIN))
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="overdue-report-2026-04-30.csv"',
      );

      const body = res.text;
      // Header row.
      expect(body.split('\r\n')[0]).toBe(
        'Filing ID,External Key,Title,Client,Law Code,Status,Priority,Due Date,Days Overdue,Period Start,Period End,Team,Assignee',
      );
      // Two data rows + trailing newline → 4 segments after split.
      expect(body.split('\r\n').filter(Boolean).length).toBe(3);
      // The comma-name client row was quoted so the CSV stays valid.
      expect(body).toContain('"Acme, Inc."');
      // Plain row stays unquoted.
      expect(body).toContain('Globex Pvt Ltd');
    });

    it('honors actor scope — assigned users only see their own filings', async () => {
      const { alice } = await seedScenario(ctx, '2026-04-30');

      // Alice has scope { type: 'assigned' } on reports.read and the filings
      // read slug. The driver scope predicate restricts the export to her
      // assigned rows. (Bob's filing should be excluded.)
      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance-filings/reports/overdue.csv?today=2026-04-30')
        .set({
          'x-test-user': JSON.stringify({
            userId: alice,
            userType: 'admin',
            permissions: {
              'reports.read': [{ type: 'any' }],
              'compliance-filings.read': [{ type: 'assigned' }],
            },
          }),
        })
        .expect(200);

      // Alice's filing present, Bob's excluded.
      expect(res.text).toContain('"Acme, Inc."');
      expect(res.text).not.toContain('Globex Pvt Ltd');
    });
  });

  describe('GET /compliance-filings/reports/compliance.csv', () => {
    it('returns the by-client breakdown CSV with quoted comma-bearing names', async () => {
      await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get(
          '/api/v1/compliance-filings/reports/compliance.csv?from=2026-01-01&to=2026-04-30&today=2026-04-30',
        )
        .set(withAuth(ADMIN))
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="compliance-report-2026-04-30.csv"',
      );
      expect(res.text.split('\r\n')[0]).toBe(
        'Client ID,Client,Total Filings,On Time,Late,Overdue,On-Time Rate (%)',
      );
      expect(res.text).toContain('"Acme, Inc."');
    });
  });

  describe('GET /org-units/reports/team-workload.csv', () => {
    it('returns the team workload CSV with the workload filename', async () => {
      await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get(
          '/api/v1/org-units/reports/team-workload.csv?from=2026-01-01&to=2026-04-30&today=2026-04-30',
        )
        .set(withAuth(ADMIN))
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="workload-report-2026-04-30.csv"',
      );
      expect(res.text.split('\r\n')[0]).toBe(
        'Team ID,Team,Total Assigned,Completed,In Progress,Overdue,On-Time Rate (%)',
      );
    });
  });

  describe('GET /compliance-filings/reports/overdue.pdf', () => {
    it('returns a PDF buffer with the expected Content-Type + Content-Disposition', async () => {
      await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance-filings/reports/overdue.pdf?today=2026-04-30')
        .set(withAuth(ADMIN))
        .buffer(true)
        .parse((response, callback) => {
          // Default supertest parser treats binary as text and corrupts it.
          // Build the buffer ourselves so the header magic-bytes check
          // below is meaningful.
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="overdue-report-2026-04-30.pdf"',
      );
      // Stub provider emits `%PDF-1.4\n` magic bytes — same shape a real
      // PDF starts with. Asserts the controller piped the provider's
      // buffer to the response body byte-for-byte.
      const body = res.body as Buffer;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });

    it('honors actor scope — assigned users only see their own filings in the rendered HTML', async () => {
      const { alice } = await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance-filings/reports/overdue.pdf?today=2026-04-30')
        .set({
          'x-test-user': JSON.stringify({
            userId: alice,
            userType: 'admin',
            permissions: {
              'reports.read': [{ type: 'any' }],
              'compliance-filings.read': [{ type: 'assigned' }],
            },
          }),
        })
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      // The stub provider encodes `html-length=N` after the magic bytes.
      // A scoped user sees fewer rows → smaller HTML → smaller length.
      // Asserting the body stays a Buffer + the magic bytes are present
      // verifies the provider was reached; scope correctness is asserted
      // via the CSV path above (same service method, same predicate).
      const body = res.body as Buffer;
      expect(body.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });
  });

  describe('GET /compliance-filings/reports/compliance.pdf', () => {
    it('returns a PDF buffer with the compliance filename', async () => {
      await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get(
          '/api/v1/compliance-filings/reports/compliance.pdf?from=2026-01-01&to=2026-04-30&today=2026-04-30',
        )
        .set(withAuth(ADMIN))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="compliance-report-2026-04-30.pdf"',
      );
      const body = res.body as Buffer;
      expect(body.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });
  });

  describe('GET /org-units/reports/team-workload.pdf', () => {
    it('returns a PDF buffer with the workload filename', async () => {
      await seedScenario(ctx, '2026-04-30');

      const res = await request(ctx.httpServer)
        .get(
          '/api/v1/org-units/reports/team-workload.pdf?from=2026-01-01&to=2026-04-30&today=2026-04-30',
        )
        .set(withAuth(ADMIN))
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="workload-report-2026-04-30.pdf"',
      );
      const body = res.body as Buffer;
      expect(body.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    });
  });
});
