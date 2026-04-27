import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskActionsService, type TaskActionsUser, type TaskRowForActions } from '../task-actions.service';

const ALL_PERMS: TaskActionsUser['permissions'] = {
  'tasks.read': 'any',
  'tasks.create': 'any',
  'tasks.update': 'any',
  'tasks.delete': 'any',
  'tasks.pickup': 'any',
  'tasks.reassign': 'any',
  'tasks.review': 'any',
  'tasks.complete': 'any',
  'tasks.reopen': 'any',
  'tasks.close': 'any',
};

function makeUser(overrides: Partial<TaskActionsUser> = {}): TaskActionsUser {
  return { userId: 'user-1', permissions: ALL_PERMS, ...overrides };
}

function makeTask(overrides: Partial<TaskRowForActions> = {}): TaskRowForActions {
  return {
    id: 'task-1',
    status: 'pending',
    assigneeId: null,
    assigneeTeamId: 'team-1',
    deletedAt: null,
    ...overrides,
  };
}

function makeReader(memberMap: Record<string, string[]> = { 'team-1': ['user-1'] }) {
  return {
    getMemberIds: vi.fn(async (teamId: string) => memberMap[teamId] ?? []),
  };
}

describe('TaskActionsService', () => {
  let service: TaskActionsService;
  let reader: ReturnType<typeof makeReader>;

  beforeEach(() => {
    reader = makeReader();
    service = new TaskActionsService(reader);
  });

  describe('CRUD verbs', () => {
    it('returns update/delete/clone for an active task with full perms', async () => {
      const actions = await service.computeAllowedActions(makeTask(), makeUser());
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('clone');
      expect(actions).not.toContain('restore');
    });

    it('omits CRUD verbs when permissions are missing', async () => {
      const actions = await service.computeAllowedActions(makeTask(), makeUser({ permissions: {} }));
      expect(actions).not.toContain('update');
      expect(actions).not.toContain('delete');
      expect(actions).not.toContain('clone');
    });

    it('returns restore on a soft-deleted task with update perm; suppresses other verbs', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ deletedAt: new Date() }),
        makeUser(),
      );
      expect(actions).toContain('restore');
      expect(actions).not.toContain('update');
      expect(actions).not.toContain('delete');
      expect(actions).not.toContain('clone');
      expect(actions).not.toContain('pickup');
    });
  });

  describe('pickup', () => {
    it('allows pickup when pending, unassigned, user is team member', async () => {
      const actions = await service.computeAllowedActions(makeTask(), makeUser());
      expect(actions).toContain('pickup');
    });

    it('blocks pickup when already picked up', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ assigneeId: 'someone-else' }),
        makeUser(),
      );
      expect(actions).not.toContain('pickup');
    });

    it('blocks pickup when status is not pending', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ status: 'in_progress' }),
        makeUser(),
      );
      expect(actions).not.toContain('pickup');
    });

    it('blocks pickup when user is not a team member', async () => {
      reader = makeReader({ 'team-1': ['someone-else'] });
      service = new TaskActionsService(reader);
      const actions = await service.computeAllowedActions(makeTask(), makeUser());
      expect(actions).not.toContain('pickup');
    });

    it('blocks pickup when permission is missing (no team lookup performed)', async () => {
      const actions = await service.computeAllowedActions(
        makeTask(),
        makeUser({ permissions: { 'tasks.read': 'any' } }),
      );
      expect(actions).not.toContain('pickup');
      expect(reader.getMemberIds).not.toHaveBeenCalled();
    });
  });

  describe('unclaim', () => {
    it('allows unclaim when caller is the picker on a team-pool task', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ status: 'in_progress', assigneeId: 'user-1', assigneeTeamId: 'team-1' }),
        makeUser(),
      );
      expect(actions).toContain('unclaim');
    });

    it('blocks unclaim when caller is not the assignee', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ status: 'in_progress', assigneeId: 'someone-else' }),
        makeUser(),
      );
      expect(actions).not.toContain('unclaim');
    });

    it('blocks unclaim when no team is set', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ status: 'in_progress', assigneeId: 'user-1', assigneeTeamId: null }),
        makeUser(),
      );
      expect(actions).not.toContain('unclaim');
    });
  });

  describe('reassign', () => {
    it.each(['pending', 'in_progress', 'blocked'])(
      'allows reassign while status is %s',
      async (status) => {
        const actions = await service.computeAllowedActions(makeTask({ status }), makeUser());
        expect(actions).toContain('reassign');
      },
    );

    it.each(['completed', 'cancelled'])('blocks reassign in terminal status %s', async (status) => {
      const actions = await service.computeAllowedActions(makeTask({ status }), makeUser());
      expect(actions).not.toContain('reassign');
    });

    it('blocks reassign without permission', async () => {
      const actions = await service.computeAllowedActions(
        makeTask(),
        makeUser({ permissions: { 'tasks.read': 'any' } }),
      );
      expect(actions).not.toContain('reassign');
    });
  });

  describe('workflow transitions', () => {
    it('emits transition:in_progress and transition:cancelled from pending', async () => {
      const actions = await service.computeAllowedActions(makeTask({ status: 'pending' }), makeUser());
      expect(actions).toContain('transition:in_progress');
      expect(actions).toContain('transition:cancelled');
    });

    it('emits transition:blocked from in_progress without requiring a permission slug', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ status: 'in_progress', assigneeId: 'user-1' }),
        // no transition-permissions granted
        makeUser({ permissions: { 'tasks.read': 'any' } }),
      );
      expect(actions).toContain('transition:blocked');
      expect(actions).not.toContain('transition:completed');
      expect(actions).not.toContain('transition:cancelled');
    });

    it('emits transition:in_progress from terminal states only with reopen permission', async () => {
      const noReopen = await service.computeAllowedActions(
        makeTask({ status: 'completed', assigneeId: 'user-1' }),
        makeUser({ permissions: { 'tasks.read': 'any' } }),
      );
      expect(noReopen).not.toContain('transition:in_progress');

      const withReopen = await service.computeAllowedActions(
        makeTask({ status: 'completed', assigneeId: 'user-1' }),
        makeUser({ permissions: { 'tasks.read': 'any', 'tasks.reopen': 'any' } }),
      );
      expect(withReopen).toContain('transition:in_progress');
    });

    it('emits no transitions for soft-deleted tasks', async () => {
      const actions = await service.computeAllowedActions(
        makeTask({ deletedAt: new Date() }),
        makeUser(),
      );
      expect(actions.filter((a) => a.startsWith('transition:'))).toEqual([]);
    });
  });

  describe('superadmin', () => {
    it('grants all CRUD/claim verbs via wildcard permission', async () => {
      const actions = await service.computeAllowedActions(
        makeTask(),
        makeUser({ permissions: { '*': 'any' } }),
      );
      expect(actions).toEqual(expect.arrayContaining(['update', 'delete', 'clone', 'pickup', 'reassign']));
    });
  });

  describe('computeAllowedActionsForMany', () => {
    it('returns an empty map for an empty input', async () => {
      const result = await service.computeAllowedActionsForMany([], makeUser());
      expect(result.size).toBe(0);
    });

    it('looks up each unique team only once', async () => {
      const tasks = [
        makeTask({ id: 'a', assigneeTeamId: 'team-1' }),
        makeTask({ id: 'b', assigneeTeamId: 'team-1' }),
        makeTask({ id: 'c', assigneeTeamId: 'team-2' }),
      ];
      reader = makeReader({ 'team-1': ['user-1'], 'team-2': ['user-1'] });
      service = new TaskActionsService(reader);

      await service.computeAllowedActionsForMany(tasks, makeUser());

      expect(reader.getMemberIds).toHaveBeenCalledTimes(2);
      expect(reader.getMemberIds).toHaveBeenCalledWith('team-1');
      expect(reader.getMemberIds).toHaveBeenCalledWith('team-2');
    });

    it('skips the team prefetch entirely when caller lacks pickup permission', async () => {
      const tasks = [makeTask(), makeTask({ id: 'b', assigneeTeamId: 'team-2' })];
      const result = await service.computeAllowedActionsForMany(
        tasks,
        makeUser({ permissions: { 'tasks.read': 'any' } }),
      );
      expect(reader.getMemberIds).not.toHaveBeenCalled();
      expect(result.get('task-1')).not.toContain('pickup');
      expect(result.get('b')).not.toContain('pickup');
    });
  });
});
