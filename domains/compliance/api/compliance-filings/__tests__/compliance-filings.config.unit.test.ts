import { describe, it, expect } from 'vitest';
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

  it('soft-deletes filings rather than hard-deleting them', () => {
    expect(COMPLIANCE_FILINGS_CONFIG.onDelete.mode).toBe('soft');
  });

  it('exposes the pickup/submit/complete/reject/reopen/close extra permissions', () => {
    const actions = (COMPLIANCE_FILINGS_CONFIG.extraPermissions ?? []).map((p) => p.action);
    expect(actions).toEqual(expect.arrayContaining([
      'pickup', 'submit', 'complete', 'reject', 'reopen', 'close',
    ]));
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

  describe('external key derivation', () => {
    it('formats ruleId:clientId:periodStart in a stable order', () => {
      expect(buildFilingExternalKey('rule-1', 'client-1', '2026-04-01')).toBe('rule-1:client-1:2026-04-01');
    });

    it('stamps externalKey on beforeCreate when absent', async () => {
      const beforeCreate = COMPLIANCE_FILINGS_CONFIG.hooks!.beforeCreate!;
      const out = await beforeCreate({
        title: 'Filing',
        ruleId: 'r1', clientId: 'c1', periodStart: '2026-04-01',
      }, 'actor');
      expect(out.externalKey).toBe('r1:c1:2026-04-01');
    });

    it('preserves externalKey on beforeCreate when already set', async () => {
      const beforeCreate = COMPLIANCE_FILINGS_CONFIG.hooks!.beforeCreate!;
      const out = await beforeCreate({
        title: 'Filing',
        ruleId: 'r1', clientId: 'c1', periodStart: '2026-04-01',
        externalKey: 'pre-set-key',
      }, 'actor');
      expect(out.externalKey).toBe('pre-set-key');
    });

    it('does not set externalKey when the (rule, client, period) tuple is incomplete', async () => {
      const beforeCreate = COMPLIANCE_FILINGS_CONFIG.hooks!.beforeCreate!;
      const out = await beforeCreate({ title: 'Filing', ruleId: 'r1' }, 'actor');
      expect(out.externalKey).toBeUndefined();
    });
  });

  describe('completedAt stamping', () => {
    const beforeCreate = COMPLIANCE_FILINGS_CONFIG.hooks!.beforeCreate!;
    const beforeUpdate = COMPLIANCE_FILINGS_CONFIG.hooks!.beforeUpdate!;

    it('stamps completedAt when created in completed state', async () => {
      const out = await beforeCreate({ title: 'Filing', status: 'completed' }, 'actor');
      expect(out.completedAt).toBeInstanceOf(Date);
    });

    it('does not stamp completedAt for non-completed status on create', async () => {
      const out = await beforeCreate({ title: 'Filing', status: 'pending' }, 'actor');
      expect(out.completedAt).toBeNull();
    });

    it('stamps completedAt on update transitioning to completed', async () => {
      const out = await beforeUpdate('id', { status: 'completed' }, 'actor');
      expect(out.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when transitioning away from completed', async () => {
      const out = await beforeUpdate('id', { status: 'in_progress' }, 'actor');
      expect(out.completedAt).toBeNull();
    });

    it('does not touch completedAt when status is not in the payload', async () => {
      const out = await beforeUpdate('id', { title: 'new title' }, 'actor');
      expect('completedAt' in out).toBe(false);
    });
  });
});
