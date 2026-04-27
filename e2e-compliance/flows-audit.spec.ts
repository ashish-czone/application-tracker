import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient, updateClient } from './fixtures/clients';

interface AuditLogRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  eventName: string;
  actorId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
}

interface AuditList {
  data: AuditLogRow[];
}

/**
 * §9 audit trail — named coverage.
 *
 *   US-9.1 Every write action is auditable — create + update both produce
 *          rows in `audit_logs` with the actor stamp.
 *   US-9.2 Field-level diff on update — the `changes` payload identifies
 *          the exact fields that moved and their before/after values.
 *   US-9.3 Sensitive fields are redacted — `taxId` (registered as a
 *          sensitive field on `clients`) is stripped from `before` /
 *          `after` snapshots. (Implementation note: the redaction helper
 *          deletes the field rather than replacing with `[REDACTED]` —
 *          so the test asserts absence, not the literal string.)
 *
 * Audit listener is event-bus driven and writes async; tests poll the
 * /audit-logs endpoint with a small timeout to bridge the gap.
 */
test.describe('Flow: audit trail (US-9.x)', () => {
  test.beforeAll(async () => {
    await resetState();
  });

  async function listClientAuditLogs(clientId: string): Promise<AuditLogRow[]> {
    const result = await apiClient.get<AuditList>(
      `/audit-logs?entityType=clients&entityId=${clientId}`,
    );
    return result.data;
  }

  test('US-9.1 creating a client produces an audit row', async () => {
    const client = await createClient({ name: 'AuditCreate Co' });

    await expect
      .poll(async () => (await listClientAuditLogs(client.id)).length, {
        timeout: 5_000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    const logs = await listClientAuditLogs(client.id);
    const createRow = logs.find((l) => l.action === 'create');
    expect(createRow, 'a CREATE audit row should exist for the new client').toBeTruthy();
    expect(createRow!.entityType).toBe('clients');
    expect(createRow!.entityId).toBe(client.id);
    expect(createRow!.actorId, 'audit row should stamp the e2e admin actor').toBeTruthy();
  });

  test('US-9.2 updating a client adds an UPDATE row with field-level diff', async () => {
    const client = await createClient({ name: 'AuditUpdate Original', email: 'orig@e2e.local' });

    // Settle the create-row write before mutating again so the poll below
    // can distinguish create from update.
    await expect
      .poll(async () => (await listClientAuditLogs(client.id)).length, { timeout: 5_000 })
      .toBeGreaterThan(0);

    await updateClient(client.id, { name: 'AuditUpdate Renamed', email: 'new@e2e.local' });

    await expect
      .poll(async () => {
        const all = await listClientAuditLogs(client.id);
        return all.filter((l) => l.action === 'update').length;
      }, { timeout: 5_000, intervals: [100, 250, 500, 1000] })
      .toBeGreaterThan(0);

    const logs = await listClientAuditLogs(client.id);
    const updateRow = logs.find((l) => l.action === 'update');
    expect(updateRow, 'an UPDATE audit row should exist').toBeTruthy();
    expect(updateRow!.changes, 'changes payload should be populated for an update').toBeTruthy();

    // The changes payload identifies the moved fields. We don't assert on
    // exact shape — the platform records before/after under each changed
    // field — only that the changed fields are referenced somewhere.
    const changesJson = JSON.stringify(updateRow!.changes ?? {});
    expect(changesJson).toContain('name');
    expect(changesJson).toContain('email');
  });

  test('US-9.3 sensitive fields are stripped from audit before/after snapshots', async () => {
    const taxId = `27SECRET${Date.now().toString().slice(-5)}9Z9`;
    const client = await createClient({ name: 'AuditSensitive Co', taxId });

    await expect
      .poll(async () => (await listClientAuditLogs(client.id)).length, { timeout: 5_000 })
      .toBeGreaterThan(0);

    const logs = await listClientAuditLogs(client.id);

    // Across every audit row for this client, no snapshot should leak the
    // taxId. The redactSensitiveFields helper deletes the field from
    // before/after entirely, so asserting absence covers it.
    for (const log of logs) {
      const beforeJson = JSON.stringify(log.before ?? {});
      const afterJson = JSON.stringify(log.after ?? {});
      const changesJson = JSON.stringify(log.changes ?? {});

      expect(beforeJson, `audit ${log.id} before should not leak taxId`).not.toContain(taxId);
      expect(afterJson, `audit ${log.id} after should not leak taxId`).not.toContain(taxId);
      expect(changesJson, `audit ${log.id} changes should not leak taxId`).not.toContain(taxId);
    }
  });
});
