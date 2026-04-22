import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TASKS_CONFIG, registerTasksKindLookup } from '../tasks.config';

describe('TASKS_CONFIG', () => {
  // The kind guard is fail-closed (throws if no lookup is wired), so every
  // hook test needs *some* lookup registered. Default to "no kind" so tests
  // that aren't about the guard itself just pass through.
  beforeEach(() => {
    registerTasksKindLookup(async () => null);
  });

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

    it('fails closed when the lookup has not been registered', async () => {
      // A missing wire means the host app forgot to import TasksModule. That
      // is a programming error, not a bypass — the guard refuses to run so
      // the mistake surfaces loudly instead of silently letting kinded rows
      // be mutated through generic /tasks.
      registerTasksKindLookup(null);
      await expect(beforeUpdate('task-1', { title: 'x' }, 'actor')).rejects.toThrow(
        /kind-guard is not wired/,
      );
      await expect(beforeDelete('task-1', 'actor')).rejects.toThrow(/kind-guard is not wired/);
    });
  });
});
