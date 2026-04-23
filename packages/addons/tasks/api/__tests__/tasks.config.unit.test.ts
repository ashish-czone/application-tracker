import { describe, it, expect } from 'vitest';
import { TASKS_CONFIG } from '../tasks.config';

describe('TASKS_CONFIG', () => {
  describe('polymorphic relation fields', () => {
    it('declares related_entity_type as a system, readonly, list-visible text field', () => {
      const field = TASKS_CONFIG.fieldMeta.relatedEntityType;
      expect(field).toBeDefined();
      expect(field.fieldType).toBe('text');
      expect(field.isSystem).toBe(true);
      expect(field.isReadonly).toBe(true);
      expect(field.excludeFromList).toBeFalsy();
      expect(TASKS_CONFIG.listFields).toContain('relatedEntityType');
    });

    it('declares related_entity_id as a system, readonly text field hidden from lists', () => {
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
      expect(names).toEqual(['pending', 'in_progress', 'blocked', 'completed', 'cancelled']);
    });

    it('marks completed and cancelled as system states', () => {
      const byName = Object.fromEntries(workflow.states.map((s) => [s.name, s]));
      expect(byName.completed.isSystem).toBe(true);
      expect(byName.cancelled.isSystem).toBe(true);
    });

    it('gates pending -> in_progress by tasks.pickup', () => {
      const pending = workflow.transitions.find((t) => t.from === 'pending')!;
      const toInProgress = pending.to.find(
        (t): t is { state: string; requiredPermissions?: string[] } =>
          typeof t === 'object' && t.state === 'in_progress',
      );
      expect(toInProgress?.requiredPermissions).toContain('tasks.pickup');
    });

    it('allows in_progress <-> blocked as implicit assignee transitions (no permission)', () => {
      const inProgress = workflow.transitions.find((t) => t.from === 'in_progress')!;
      expect(inProgress.to).toContain('blocked');
      const blocked = workflow.transitions.find((t) => t.from === 'blocked')!;
      expect(blocked.to).toContain('in_progress');
    });

    it('gates in_progress -> completed by tasks.complete', () => {
      const inProgress = workflow.transitions.find((t) => t.from === 'in_progress')!;
      const toCompleted = inProgress.to.find(
        (t): t is { state: string; requiredPermissions?: string[] } =>
          typeof t === 'object' && t.state === 'completed',
      );
      expect(toCompleted?.requiredPermissions).toContain('tasks.complete');
    });

    it('gates blocked -> completed by tasks.complete', () => {
      const blocked = workflow.transitions.find((t) => t.from === 'blocked')!;
      const toCompleted = blocked.to.find(
        (t): t is { state: string; requiredPermissions?: string[] } =>
          typeof t === 'object' && t.state === 'completed',
      );
      expect(toCompleted?.requiredPermissions).toContain('tasks.complete');
    });

    it('allows cancelled via tasks.close from pending, in_progress, and blocked', () => {
      for (const from of ['pending', 'in_progress', 'blocked'] as const) {
        const transition = workflow.transitions.find((t) => t.from === from)!;
        const toCancelled = transition.to.find(
          (t): t is { state: string; requiredPermissions?: string[] } =>
            typeof t === 'object' && t.state === 'cancelled',
        );
        expect(toCancelled).toBeDefined();
        expect(toCancelled?.requiredPermissions).toContain('tasks.close');
      }
    });

    it('allows reopening completed and cancelled tasks to in_progress via tasks.reopen', () => {
      for (const from of ['completed', 'cancelled'] as const) {
        const transition = workflow.transitions.find((t) => t.from === from)!;
        const toInProgress = transition.to.find(
          (t): t is { state: string; requiredPermissions?: string[] } =>
            typeof t === 'object' && t.state === 'in_progress',
        );
        expect(toInProgress?.requiredPermissions).toContain('tasks.reopen');
      }
    });
  });

  describe('completedAt stamping', () => {
    const beforeCreate = TASKS_CONFIG.hooks!.beforeCreate!;
    const beforeUpdate = TASKS_CONFIG.hooks!.beforeUpdate!;

    it('declares completedAt as a system readonly datetime field', () => {
      const field = TASKS_CONFIG.fieldMeta.completedAt;
      expect(field).toBeDefined();
      expect(field.fieldType).toBe('datetime');
      expect(field.isSystem).toBe(true);
      expect(field.isReadonly).toBe(true);
      expect(field.excludeFromList).toBe(true);
    });

    it('beforeCreate stamps completedAt when created in completed state', async () => {
      const out = await beforeCreate({ title: 't', status: 'completed' }, 'actor');
      expect(out.completedAt).toBeInstanceOf(Date);
    });

    it('beforeCreate does not stamp completedAt for non-completed status', async () => {
      const out = await beforeCreate({ title: 't', status: 'pending' }, 'actor');
      expect(out.completedAt).toBeNull();
    });

    it('beforeCreate leaves completedAt absent when status is not in payload', async () => {
      const out = await beforeCreate({ title: 't' }, 'actor');
      expect('completedAt' in out).toBe(false);
    });

    it('beforeUpdate stamps completedAt when transitioning to completed', async () => {
      const out = await beforeUpdate('id', { status: 'completed' }, 'actor');
      expect(out.completedAt).toBeInstanceOf(Date);
    });

    it('beforeUpdate clears completedAt when transitioning away from completed', async () => {
      const out = await beforeUpdate('id', { status: 'pending' }, 'actor');
      expect(out.completedAt).toBeNull();
    });

    it('beforeUpdate does not touch completedAt when status is not in payload', async () => {
      const out = await beforeUpdate('id', { title: 'new title' }, 'actor');
      expect('completedAt' in out).toBe(false);
    });
  });
});
