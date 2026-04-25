import { describe, it, expect } from 'vitest';
import { readNotesFeature } from '@packages/notes';
import { readAttachmentsFeature } from '@packages/attachments';
import { COMPLIANCE_FILINGS_CONFIG, buildFilingExternalKey } from '../compliance-filings.config';

type TargetObject = { state: string; requiredPermissions?: string[]; reasonRequired?: boolean; commentRequired?: boolean };

function findTarget(transitions: { from: string; to: Array<string | TargetObject> }[], from: string, targetState: string): TargetObject | string | undefined {
  const t = transitions.find((t) => t.from === from);
  return t?.to.find((x) => (typeof x === 'string' ? x === targetState : x.state === targetState));
}

describe('COMPLIANCE_FILINGS_CONFIG', () => {
  it('is registered under the compliance-filings slug', () => {
    expect(COMPLIANCE_FILINGS_CONFIG.slug).toBe('compliance-filings');
  });

  it('soft-deletes filings (schema includes deletedAt/deletedBy)', () => {
    expect(COMPLIANCE_FILINGS_CONFIG.systemColumns).toEqual(
      expect.arrayContaining(['deletedAt', 'deletedBy']),
    );
  });

  it('exposes the pickup/submit/complete/reject/reopen/close extra permissions', () => {
    const actions = (COMPLIANCE_FILINGS_CONFIG.extraPermissions ?? []).map((p) => p.action);
    expect(actions).toEqual(expect.arrayContaining([
      'pickup', 'submit', 'complete', 'reject', 'reopen', 'close',
    ]));
  });

  it('enables notes on the filing entity (Stream G / Q29)', () => {
    // Compliance comments = notes addon attached to compliance-filings via
    // notesFeature() — surfaces the Notes tab on the auto-rendered detail
    // page via compliance-web's extraDetailTabs.
    expect(readNotesFeature(COMPLIANCE_FILINGS_CONFIG.features)?.enabled).toBe(true);
  });

  describe('attachments (Stream F / Q26 + Q27 + Q28)', () => {
    const attachmentsValue = readAttachmentsFeature(COMPLIANCE_FILINGS_CONFIG.features);

    it('enables attachments on the filing entity', () => {
      expect(attachmentsValue?.enabled).toBe(true);
    });

    it('pins the MIME whitelist to the compliance-domain list (Q26)', () => {
      const accepted = attachmentsValue?.acceptedMimeTypes ?? [];
      // ZIPs and executables are excluded by the whitelist — the test exists to
      // catch any accidental relaxation of this constraint.
      expect(accepted).toContain('application/pdf');
      expect(accepted).toContain('image/png');
      expect(accepted).toContain('text/csv');
      expect(accepted).not.toContain('application/zip');
      expect(accepted).not.toContain('application/x-msdownload');
    });

    it('caps per-file upload at 25 MB (Q27)', () => {
      expect(attachmentsValue?.maxFileSize).toBe(25 * 1024 * 1024);
    });

    it('soft-deletes attachments so evidence is recoverable (Q28)', () => {
      expect(attachmentsValue?.deleteMode).toBe('soft');
    });
  });

  describe('workflow', () => {
    const workflow = COMPLIANCE_FILINGS_CONFIG.fieldMeta.status.workflow!;

    it('uses the compliance-filing-status slug with pending as initial state', () => {
      expect(workflow.slug).toBe('compliance-filing-status');
      expect(workflow.initialState).toBe('pending');
    });

    it('declares the six expected states in order', () => {
      expect(workflow.states.map((s) => s.name)).toEqual([
        'pending', 'in_progress', 'review', 'rejected', 'completed', 'cancelled',
      ]);
    });

    it('marks completed and cancelled as system terminals', () => {
      const byName = Object.fromEntries(workflow.states.map((s) => [s.name, s]));
      expect(byName.completed.isSystem).toBe(true);
      expect(byName.cancelled.isSystem).toBe(true);
    });

    it('gates pending -> in_progress by compliance-filings.pickup', () => {
      const target = findTarget(workflow.transitions, 'pending', 'in_progress') as TargetObject;
      expect(target?.requiredPermissions).toContain('compliance-filings.pickup');
    });

    it('allows in_progress <-> pending as implicit assignee transitions (release/rework)', () => {
      expect(findTarget(workflow.transitions, 'in_progress', 'pending')).toBe('pending');
    });

    it('gates in_progress -> review by compliance-filings.submit', () => {
      const target = findTarget(workflow.transitions, 'in_progress', 'review') as TargetObject;
      expect(target?.requiredPermissions).toContain('compliance-filings.submit');
    });

    it('gates review -> rejected by compliance-filings.reject (in addition to reason/comment)', () => {
      const target = findTarget(workflow.transitions, 'review', 'rejected') as TargetObject;
      expect(target?.requiredPermissions).toContain('compliance-filings.reject');
    });

    it('gates review -> completed by compliance-filings.complete', () => {
      const target = findTarget(workflow.transitions, 'review', 'completed') as TargetObject;
      expect(target?.requiredPermissions).toContain('compliance-filings.complete');
    });

    it('requires reason + comment when rejecting from review', () => {
      const target = findTarget(workflow.transitions, 'review', 'rejected') as TargetObject;
      expect(target?.reasonRequired).toBe(true);
      expect(target?.commentRequired).toBe(true);
    });

    it('allows rejected -> in_progress so the preparer can rework', () => {
      expect(findTarget(workflow.transitions, 'rejected', 'in_progress')).toBe('in_progress');
    });

    it('allows cancelling via compliance-filings.close from every non-terminal state', () => {
      for (const from of ['pending', 'in_progress', 'review', 'rejected'] as const) {
        const target = findTarget(workflow.transitions, from, 'cancelled') as TargetObject;
        expect(target?.requiredPermissions).toContain('compliance-filings.close');
      }
    });

    it('allows reopening completed and cancelled filings via compliance-filings.reopen', () => {
      for (const from of ['completed', 'cancelled'] as const) {
        const target = findTarget(workflow.transitions, from, 'in_progress') as TargetObject;
        expect(target?.requiredPermissions).toContain('compliance-filings.reopen');
      }
    });
  });

  describe('data-access anchors', () => {
    const dataAccess = COMPLIANCE_FILINGS_CONFIG.dataAccess!;

    it('anchors own/assigned/unit scopes on the filing columns', () => {
      // `own` resolves via the creator anchor; `assigned` via assignee;
      // `unit`/`descendants` via team. Renaming any of these columns would
      // silently break scope resolution — this test is the tripwire.
      expect(dataAccess.anchors?.creator).toBe('createdBy');
      expect(dataAccess.anchors?.assignee).toBe('assigneeId');
      expect(dataAccess.anchors?.team).toBe('assigneeTeamId');
    });

    it('registers the unassigned_in_unit custom scope for pickup', () => {
      // Preparers/Reviewers hold `compliance-filings.pickup` scoped to
      // `unassigned_in_unit` so they can only self-claim unclaimed filings
      // from a team they belong to.
      const keys = (dataAccess.scopes ?? []).map((s) => s.key);
      expect(keys).toContain('unassigned_in_unit');
    });

    it('drops the legacy my-filings scope', () => {
      // my-filings (assigned-to-me OR unassigned-in-my-teams) is now
      // expressed as `assigned` + `unassigned_in_unit` at the grant level.
      const keys = (dataAccess.scopes ?? []).map((s) => s.key);
      expect(keys).not.toContain('my-filings');
    });
  });

  describe('external key derivation', () => {
    it('formats ruleId:clientId:periodStart in a stable order', () => {
      expect(buildFilingExternalKey('rule-1', 'client-1', '2026-04-01')).toBe('rule-1:client-1:2026-04-01');
    });
  });
});
