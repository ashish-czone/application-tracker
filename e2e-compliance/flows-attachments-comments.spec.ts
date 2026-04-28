import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { createComplianceFiling, type ComplianceFiling } from './fixtures/filings';
import {
  deleteAttachment,
  listFilingAttachments,
  uploadFilingAttachment,
} from './fixtures/attachments';
import { createFilingComment, listFilingComments } from './fixtures/notes';

interface AuditLogRow {
  id: string;
  action: string;
  eventName: string;
  entityType: string;
  entityId: string;
}

interface AuditList {
  data: AuditLogRow[];
}

/**
 * §10 files and comments on filings — named coverage:
 *
 *   US-10.1 Upload an attachment to a filing — appears under the filing
 *           with name, size, mime, and uploader.
 *   US-10.2 Delete an attachment — disappears from the listing; an audit
 *           row records the delete.
 *   US-10.3 Comment on a filing — appears in chronological order with
 *           author + timestamp.
 *
 * Driven against the platform's `attachments` and `notes` addons, both
 * already registered on the compliance-filings entity via
 * `attachmentsFeature` + `notesFeature` in `compliance-filings.config.ts`.
 */
test.describe('Flow: attachments + comments on filings (US-10.x)', () => {
  let team: OrgUnit;
  let law: Law;
  let filing: ComplianceFiling;

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const client = await createClient();
    const rule = await createComplianceRule({ lawId: law.id });
    await createClientRegistration(client.id, law.id);

    filing = await createComplianceFiling({
      ruleId: rule.id,
      clientId: client.id,
      lawId: law.id,
      assigneeTeamId: team.id,
      dueDate: '2026-06-15',
    });
  });

  test('US-10.1 uploading an attachment lists it under the filing with metadata', async () => {
    const csv = 'amount,currency\n10000,INR\n';
    const uploaded = await uploadFilingAttachment({
      entityId: filing.id,
      fileName: 'challan-q1.csv',
      content: csv,
    });
    expect(uploaded.entityType).toBe('compliance-filings');
    expect(uploaded.entityId).toBe(filing.id);
    expect(uploaded.originalName).toBe('challan-q1.csv');
    expect(uploaded.size).toBe(new TextEncoder().encode(csv).byteLength);
    expect(uploaded.mimeType).toBe('text/csv');
    expect(uploaded.uploadedBy, 'uploader stamped from JWT').toBeTruthy();

    const list = await listFilingAttachments(filing.id);
    expect(list.data.some((a) => a.id === uploaded.id), 'attachment in listing').toBe(true);
  });

  test('US-10.2 deleting an attachment removes it from the listing and audits the delete', async () => {
    const uploaded = await uploadFilingAttachment({
      entityId: filing.id,
      fileName: 'to-delete.csv',
    });

    const before = await listFilingAttachments(filing.id);
    expect(before.data.some((a) => a.id === uploaded.id)).toBe(true);

    await deleteAttachment(uploaded.id);

    const after = await listFilingAttachments(filing.id);
    expect(after.data.some((a) => a.id === uploaded.id), 'deleted attachment removed from listing').toBe(false);

    // The attachments addon writes audit rows keyed on the attachment
    // itself (entityType='attachments', entityId=<attachment-id>) with
    // targetEntityType/targetEntityId pointing at the parent filing —
    // poll the attachment's audit trail for a delete-shaped row.
    await expect
      .poll(async () => {
        const audit = await apiClient.get<AuditList>(
          `/audit-logs?entityType=attachments&entityId=${uploaded.id}`,
        );
        return audit.data.some(
          (row) => /delete|remove/i.test(row.action ?? '') || /deleted/i.test(row.eventName ?? ''),
        );
      }, { timeout: 5_000, intervals: [200, 400, 800] })
      .toBe(true);
  });

  test('US-10.3 comments on a filing appear in chronological order with author + timestamp', async () => {
    const first = await createFilingComment({
      entityId: filing.id,
      content: 'First comment on the filing',
    });
    const second = await createFilingComment({
      entityId: filing.id,
      content: 'Second comment, follow-up',
    });

    const comments = await listFilingComments(filing.id);
    const ours = comments.data
      .filter((n) => n.id === first.id || n.id === second.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    expect(ours.length).toBe(2);
    expect(ours[0].id).toBe(first.id);
    expect(ours[1].id).toBe(second.id);

    for (const comment of ours) {
      expect(comment.authorId, 'comment carries author').toBeTruthy();
      expect(comment.createdAt, 'comment carries timestamp').toBeTruthy();
      expect(comment.entityId).toBe(filing.id);
    }
  });
});
