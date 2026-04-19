import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TASKS_CONFIG, registerTasksKindLookup } from '../tasks.config';

describe('TASKS_CONFIG', () => {
  describe('kind discriminator', () => {
    it('declares kind as a system, readonly, list-visible text field', () => {
      const field = TASKS_CONFIG.fieldMeta.kind;
      expect(field).toBeDefined();
      expect(field.fieldType).toBe('text');
      expect(field.isSystem).toBe(true);
      expect(field.isReadonly).toBe(true);
      expect(field.excludeFromList).toBeFalsy();
      // Kind must be visible in the unified /tasks list so operators can
      // tell ad-hoc tasks apart from domain-owned ones (compliance, etc.).
      expect(TASKS_CONFIG.listFields).toContain('kind');
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

  describe('kind guard', () => {
    const beforeCreate = TASKS_CONFIG.hooks!.beforeCreate!;
    const beforeUpdate = TASKS_CONFIG.hooks!.beforeUpdate!;
    const beforeDelete = TASKS_CONFIG.hooks!.beforeDelete!;

    afterEach(() => {
      // Reset the module-level lookup so other tests aren't affected.
      registerTasksKindLookup(async () => null);
    });

    it('beforeCreate rejects payloads that try to set kind', async () => {
      await expect(beforeCreate({ title: 't', kind: 'compliance' }, 'actor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('beforeUpdate rejects payloads that try to set kind', async () => {
      await expect(beforeUpdate('id', { kind: 'compliance' }, 'actor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('beforeUpdate throws ConflictException when the task has a non-null kind', async () => {
      registerTasksKindLookup(async () => 'compliance');
      await expect(beforeUpdate('task-1', { title: 'new' }, 'actor')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('beforeUpdate passes through when the task has no kind', async () => {
      registerTasksKindLookup(async () => null);
      const out = await beforeUpdate('task-1', { title: 'new' }, 'actor');
      expect(out.title).toBe('new');
    });

    it('beforeDelete throws ConflictException when the task has a non-null kind', async () => {
      registerTasksKindLookup(async () => 'compliance');
      await expect(beforeDelete('task-1', 'actor')).rejects.toBeInstanceOf(ConflictException);
    });

    it('beforeDelete allows ad-hoc tasks (kind is null)', async () => {
      registerTasksKindLookup(async () => null);
      await expect(beforeDelete('task-1', 'actor')).resolves.not.toThrow();
    });

    it('fails open when the lookup has not been registered', async () => {
      // Simulate a fresh module load (e.g. tests that don't wire TasksModule).
      // If we can't look up kind, we don't block — the guard is a defense-in-depth
      // layer, not the source of truth.
      const freshLookup = vi.fn(async () => null);
      registerTasksKindLookup(freshLookup);
      await expect(beforeUpdate('task-1', { title: 'x' }, 'actor')).resolves.toBeDefined();
    });
  });
});
