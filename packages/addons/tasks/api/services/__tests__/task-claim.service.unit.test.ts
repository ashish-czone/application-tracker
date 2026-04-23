import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TaskClaimService } from '../task-claim.service';

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
  });

  describe('pickup', () => {
    it('throws BadRequest when task does not exist', async () => {
      mockDb._select.where.mockResolvedValueOnce([]);
      await expect(service.pickup('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws Conflict when task is not in pending status', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', status: 'in_progress', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      await expect(service.pickup('task-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('throws Conflict when task is already picked up', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', status: 'pending', assigneeId: 'other-user', assigneeTeamId: 'team-1' },
      ]);
      await expect(service.pickup('task-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('throws Forbidden when user is not a team member', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', status: 'pending', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      mockOrgUnits.getMemberIds.mockResolvedValueOnce(['other-user']);
      await expect(service.pickup('task-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws Conflict when another user picked it up first (optimistic lock)', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', status: 'pending', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      mockOrgUnits.getMemberIds.mockResolvedValueOnce(['user-1']);
      mockDb._update.returning.mockResolvedValueOnce([]);
      await expect(service.pickup('task-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('assigns the caller and transitions status to in_progress atomically', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', status: 'pending', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      mockOrgUnits.getMemberIds.mockResolvedValueOnce(['user-1']);
      mockDb._update.returning.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'user-1', status: 'in_progress' },
      ]);
      const result = await service.pickup('task-1', 'user-1');
      expect(result).toEqual({ id: 'task-1', assigneeId: 'user-1', status: 'in_progress' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeId: 'user-1', status: 'in_progress' });
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

    it('throws BadRequest when task is not picked up', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws Forbidden when another user picked up the task', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'other-user', assigneeTeamId: 'team-1' },
      ]);
      await expect(service.unclaim('task-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('clears the assignee when caller picked up the task', async () => {
      mockDb._select.where.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'user-1', assigneeTeamId: 'team-1' },
      ]);
      const result = await service.unclaim('task-1', 'user-1');
      expect(result).toEqual({ id: 'task-1' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeId: null });
    });
  });

  describe('reassign', () => {
    it('throws BadRequest when teamId is missing', async () => {
      await expect(service.reassign('task-1', { teamId: '' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when task does not exist', async () => {
      mockDb._select.where.mockResolvedValueOnce([]);
      await expect(service.reassign('task-1', { teamId: 'team-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each(['completed', 'cancelled'])('throws Conflict when task is %s (terminal)', async (status) => {
      mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1', status }]);
      await expect(service.reassign('task-1', { teamId: 'team-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it.each(['pending', 'in_progress', 'blocked'])(
      'allows reassign from %s status',
      async (status) => {
        mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1', status }]);
        mockDb._update.returning.mockResolvedValueOnce([
          { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
        ]);
        const result = await service.reassign('task-1', { teamId: 'team-1' });
        expect(result.assigneeTeamId).toBe('team-1');
      },
    );

    it('assigns team only (user stays null)', async () => {
      mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1', status: 'pending' }]);
      mockDb._update.returning.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      const result = await service.reassign('task-1', { teamId: 'team-1' });
      expect(result).toEqual({ id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeTeamId: 'team-1', assigneeId: null });
    });

    it('assigns both team and user (user must live inside the team)', async () => {
      mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1', status: 'in_progress' }]);
      mockDb._update.returning.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: 'user-1', assigneeTeamId: 'team-1' },
      ]);
      const result = await service.reassign('task-1', { teamId: 'team-1', userId: 'user-1' });
      expect(result).toEqual({ id: 'task-1', assigneeId: 'user-1', assigneeTeamId: 'team-1' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeTeamId: 'team-1', assigneeId: 'user-1' });
    });

    it('clears assignee when userId is explicitly null', async () => {
      mockDb._select.where.mockResolvedValueOnce([{ id: 'task-1', status: 'blocked' }]);
      mockDb._update.returning.mockResolvedValueOnce([
        { id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' },
      ]);
      const result = await service.reassign('task-1', { teamId: 'team-1', userId: null });
      expect(result).toEqual({ id: 'task-1', assigneeId: null, assigneeTeamId: 'team-1' });
      expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeTeamId: 'team-1', assigneeId: null });
    });
  });

});
