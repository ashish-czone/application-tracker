import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TaskClaimService } from '../task-claim.service';
import { registerTasksKindLookup } from '../../tasks.config';

function createMockDb() {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    _select: selectChain,
    _update: updateChain,
  };
}

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

function createMockOrgUnitService(memberIds: string[] = []) {
  return {
    getMemberIds: vi.fn().mockResolvedValue(memberIds),
  } as any;
}

describe('TaskClaimService', () => {
  let service: TaskClaimService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockOrgUnits: ReturnType<typeof createMockOrgUnitService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrgUnits = createMockOrgUnitService();
    service = new TaskClaimService(createMockDatabaseService(mockDb), mockOrgUnits);
    // Ad-hoc task by default; individual tests override to 'compliance' etc.
    registerTasksKindLookup(async () => null);
  });

  afterEach(() => {
    registerTasksKindLookup(null);
  });

  describe('claim', () => {
    it('throws BadRequest when task does not exist', async () => {
      mockDb._select.where.mockResolvedValueOnce([]);
      await expect(service.claim('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when task has no team (not a claimable task)', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: null },
      ]);
      await expect(service.claim('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws Conflict when task is already claimed', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'other-user', assigneeTeamId: 'team-1' },
      ]);
      await expect(service.claim('task-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('throws Forbidden when user is not a team member', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      mockOrgUnits.getMemberIds.mockResolvedValueOnce(['other-user']);
      await expect(service.claim('task-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws Conflict when another user claimed it first (optimistic lock)', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      mockOrgUnits.getMemberIds.mockResolvedValueOnce(['user-1']);
      mockDb._update.returning.mockResolvedValueOnce([]);
      await expect(service.claim('task-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('returns the claim when user is a team member and task is unclaimed', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      mockOrgUnits.getMemberIds.mockResolvedValueOnce(['user-1']);
      mockDb._update.returning.mockResolvedValueOnce([{ id: 'task-1', assigneeId: 'user-1' }]);
      const result = await service.claim('task-1', 'user-1');
      expect(result).toEqual({ id: 'task-1', assigneeId: 'user-1' });
    });
  });

  describe('unclaim', () => {
    it('throws BadRequest when task does not exist', async () => {
      mockDb._select.where.mockResolvedValueOnce([]);
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when task is not team-assigned', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'user-1', assigneeTeamId: null },
      ]);
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when task is not claimed', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws Forbidden when another user claimed the task', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'other-user', assigneeTeamId: 'team-1' },
      ]);
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('clears the assignee when caller is the claimant', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'user-1', assigneeTeamId: 'team-1' },
      ]);
      const result = await service.unclaim('task-1', 'user-1');
      expect(result).toEqual({ id: 'task-1' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeId: null });
    });
  });

  describe('assign', () => {
    it('throws BadRequest when neither userId nor teamId provided', async () => {
      await expect(service.assign('task-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when both userId and teamId provided', async () => {
      await expect(
        service.assign('task-1', { userId: 'user-1', teamId: 'team-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when task does not exist', async () => {
      mockDb._select.where.mockResolvedValueOnce([]);
      await expect(service.assign('task-1', { userId: 'user-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('assigns to user and clears team', async () => {
      mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1' }]);
      mockDb._update.returning.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'user-1', assigneeTeamId: null },
      ]);
      const result = await service.assign('task-1', { userId: 'user-1' });
      expect(result).toEqual({ id: 'task-1', assigneeId: 'user-1', assigneeTeamId: null });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeId: 'user-1', assigneeTeamId: null });
    });

    it('assigns to team and clears user', async () => {
      mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1' }]);
      mockDb._update.returning.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      const result = await service.assign('task-1', { teamId: 'team-1' });
      expect(result).toEqual({ id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeTeamId: 'team-1', assigneeId: null });
    });
  });

  describe('kind guard', () => {
    it('claim rejects kind-owned tasks with ConflictException', async () => {
      registerTasksKindLookup(async () => 'compliance');
      await expect(service.claim('task-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('unclaim rejects kind-owned tasks with ConflictException', async () => {
      registerTasksKindLookup(async () => 'compliance');
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('assign rejects kind-owned tasks with ConflictException', async () => {
      registerTasksKindLookup(async () => 'compliance');
      await expect(service.assign('task-1', { userId: 'user-1' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('assign runs input validation before the guard (missing both ids)', async () => {
      registerTasksKindLookup(async () => 'compliance');
      // Payload-shape errors should still surface as BadRequest — the guard
      // doesn't need to run because there's no valid mutation to block.
      await expect(service.assign('task-1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
