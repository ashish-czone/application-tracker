import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiValueService } from '../multi-value.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    transaction: vi.fn().mockImplementation(async (fn: any) => fn(createMockTx())),
    _chain: mockChain,
  };
}

function createMockTx() {
  const txChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(txChain),
    insert: vi.fn().mockReturnValue(txChain),
    delete: vi.fn().mockReturnValue(txChain),
    _chain: txChain,
  };
}

describe('MultiValueService', () => {
  let service: MultiValueService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new MultiValueService(databaseService);
  });

  // --- getValues ---

  describe('getValues', () => {
    it('should return target IDs ordered by sort order', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([
        { targetId: 'user-1' },
        { targetId: 'user-2' },
        { targetId: 'user-3' },
      ]);

      const result = await service.getValues('job_openings', 'jo-1', 'assignedRecruiters');

      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when no values found', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.getValues('job_openings', 'jo-1', 'assignedRecruiters');

      expect(result).toEqual([]);
    });

    it('should query with correct entity type, entity ID, and field key', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      await service.getValues('candidates', 'c-42', 'interviewers');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });
  });

  // --- getAllForEntity ---

  describe('getAllForEntity', () => {
    it('should group values by field key', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([
        { fieldKey: 'assignedRecruiters', targetId: 'user-1' },
        { fieldKey: 'assignedRecruiters', targetId: 'user-2' },
        { fieldKey: 'reviewers', targetId: 'user-3' },
        { fieldKey: 'reviewers', targetId: 'user-4' },
      ]);

      const result = await service.getAllForEntity('job_openings', 'jo-1');

      expect(result).toEqual({
        assignedRecruiters: ['user-1', 'user-2'],
        reviewers: ['user-3', 'user-4'],
      });
    });

    it('should return empty object when no values found', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.getAllForEntity('job_openings', 'jo-1');

      expect(result).toEqual({});
    });

    it('should handle a single field key with one value', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([
        { fieldKey: 'owner', targetId: 'user-99' },
      ]);

      const result = await service.getAllForEntity('contacts', 'ct-1');

      expect(result).toEqual({
        owner: ['user-99'],
      });
    });

    it('should preserve order within each field key group', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([
        { fieldKey: 'team', targetId: 'user-a' },
        { fieldKey: 'team', targetId: 'user-b' },
        { fieldKey: 'team', targetId: 'user-c' },
      ]);

      const result = await service.getAllForEntity('projects', 'p-1');

      expect(result.team).toEqual(['user-a', 'user-b', 'user-c']);
    });
  });

  // --- setValues ---

  describe('setValues', () => {
    it('should delete existing values then insert new ones when no transaction provided', async () => {
      const txMock = createMockTx();
      mockDb.transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

      await service.setValues('job_openings', 'jo-1', 'assignedRecruiters', ['user-1', 'user-2']);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(txMock.delete).toHaveBeenCalled();
      expect(txMock.insert).toHaveBeenCalled();
    });

    it('should only delete when target IDs array is empty', async () => {
      const txMock = createMockTx();
      mockDb.transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

      await service.setValues('job_openings', 'jo-1', 'assignedRecruiters', []);

      expect(txMock.delete).toHaveBeenCalled();
      expect(txMock.insert).not.toHaveBeenCalled();
    });

    it('should use caller-provided transaction instead of creating a new one', async () => {
      const externalTx = createMockTx();

      await service.setValues('job_openings', 'jo-1', 'assignedRecruiters', ['user-1'], externalTx);

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(externalTx.delete).toHaveBeenCalled();
      expect(externalTx.insert).toHaveBeenCalled();
    });

    it('should assign sort order based on array index', async () => {
      const txMock = createMockTx();
      let insertedValues: any;
      txMock._chain.values.mockImplementationOnce((vals: any) => {
        insertedValues = vals;
        return txMock._chain;
      });
      mockDb.transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

      await service.setValues('job_openings', 'jo-1', 'members', ['u-a', 'u-b', 'u-c']);

      expect(insertedValues).toEqual([
        { entityType: 'job_openings', entityId: 'jo-1', fieldKey: 'members', targetId: 'u-a', sortOrder: 0 },
        { entityType: 'job_openings', entityId: 'jo-1', fieldKey: 'members', targetId: 'u-b', sortOrder: 1 },
        { entityType: 'job_openings', entityId: 'jo-1', fieldKey: 'members', targetId: 'u-c', sortOrder: 2 },
      ]);
    });

    it('should handle a single target ID', async () => {
      const txMock = createMockTx();
      mockDb.transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

      await service.setValues('contacts', 'ct-5', 'primaryOwner', ['user-1']);

      expect(txMock.delete).toHaveBeenCalled();
      expect(txMock.insert).toHaveBeenCalled();
    });

    it('should delete then skip insert for empty array with external transaction', async () => {
      const externalTx = createMockTx();

      await service.setValues('contacts', 'ct-5', 'owners', [], externalTx);

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(externalTx.delete).toHaveBeenCalled();
      expect(externalTx.insert).not.toHaveBeenCalled();
    });
  });

  // --- removeAllForEntity ---

  describe('removeAllForEntity', () => {
    it('should delete all multi-values for the entity', async () => {
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      await service.removeAllForEntity('candidates', 'c-1');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should resolve without error when entity has no multi-values', async () => {
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      await expect(service.removeAllForEntity('candidates', 'nonexistent'))
        .resolves.toBeUndefined();
    });
  });

  // --- findEntitiesByTarget ---

  describe('findEntitiesByTarget', () => {
    it('should return entity IDs that reference the given target', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { entityId: 'jo-1' },
        { entityId: 'jo-3' },
        { entityId: 'jo-7' },
      ]);

      const result = await service.findEntitiesByTarget('job_openings', 'assignedRecruiters', 'user-42');

      expect(result).toEqual(['jo-1', 'jo-3', 'jo-7']);
    });

    it('should return empty array when no entities reference the target', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.findEntitiesByTarget('job_openings', 'assignedRecruiters', 'user-nobody');

      expect(result).toEqual([]);
    });

    it('should query with correct entity type, field key, and target ID', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      await service.findEntitiesByTarget('projects', 'teamMembers', 'user-55');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });
  });
});
