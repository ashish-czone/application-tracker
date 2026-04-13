import { describe, it, expect } from 'vitest';
import { TASKS_CONFIG } from '../tasks.config';

describe('TASKS_CONFIG', () => {
  describe('polymorphic relation fields', () => {
    it('declares relatedEntityType as a system, readonly, list-excluded text field', () => {
      const field = TASKS_CONFIG.fieldMeta.relatedEntityType;
      expect(field).toBeDefined();
      expect(field.fieldType).toBe('text');
      expect(field.isSystem).toBe(true);
      expect(field.isReadonly).toBe(true);
      expect(field.excludeFromList).toBe(true);
    });

    it('declares relatedEntityId as a system, readonly, list-excluded text field', () => {
      const field = TASKS_CONFIG.fieldMeta.relatedEntityId;
      expect(field).toBeDefined();
      expect(field.fieldType).toBe('text');
      expect(field.isSystem).toBe(true);
      expect(field.isReadonly).toBe(true);
      expect(field.excludeFromList).toBe(true);
    });
  });

  describe('workflow', () => {
    const workflow = TASKS_CONFIG.fieldMeta.status.workflow!;

    it('uses pending as the initial state', () => {
      expect(workflow.initialState).toBe('pending');
    });

    it('declares the five expected states in order', () => {
      const names = workflow.states.map((s) => s.name);
      expect(names).toEqual(['pending', 'in_progress', 'review', 'completed', 'cancelled']);
    });

    it('allows pending -> in_progress without permission', () => {
      const pending = workflow.transitions.find((t) => t.from === 'pending')!;
      expect(pending.to).toContain('in_progress');
    });

    it('gates in_progress -> review by tasks.submitForReview', () => {
      const inProgress = workflow.transitions.find((t) => t.from === 'in_progress')!;
      const toReview = inProgress.to.find(
        (t): t is { state: string; requiredPermissions?: string[] } =>
          typeof t === 'object' && t.state === 'review',
      );
      expect(toReview?.requiredPermissions).toContain('tasks.submitForReview');
    });

    it('gates review -> completed by tasks.approveReview', () => {
      const review = workflow.transitions.find((t) => t.from === 'review')!;
      const toCompleted = review.to.find(
        (t): t is { state: string; requiredPermissions?: string[] } =>
          typeof t === 'object' && t.state === 'completed',
      );
      expect(toCompleted?.requiredPermissions).toContain('tasks.approveReview');
    });

    it('allows cancelled as an escape from pending, in_progress, and review', () => {
      for (const from of ['pending', 'in_progress', 'review'] as const) {
        const transition = workflow.transitions.find((t) => t.from === from)!;
        const toCancelled = transition.to.find(
          (t): t is { state: string; requiredPermissions?: string[] } =>
            typeof t === 'object' && t.state === 'cancelled',
        );
        expect(toCancelled).toBeDefined();
        expect(toCancelled?.requiredPermissions).toContain('tasks.cancel');
      }
    });

    it('allows reopening completed and cancelled tasks back to pending', () => {
      for (const from of ['completed', 'cancelled'] as const) {
        const transition = workflow.transitions.find((t) => t.from === from)!;
        const toPending = transition.to.find(
          (t): t is { state: string; requiredPermissions?: string[] } =>
            typeof t === 'object' && t.state === 'pending',
        );
        expect(toPending?.requiredPermissions).toContain('tasks.reopen');
      }
    });
  });

  describe('extra permissions', () => {
    it('registers submitForReview and approveReview permissions', () => {
      const actions = TASKS_CONFIG.extraPermissions?.map((p) => p.action) ?? [];
      expect(actions).toContain('submitForReview');
      expect(actions).toContain('approveReview');
    });
  });
});
