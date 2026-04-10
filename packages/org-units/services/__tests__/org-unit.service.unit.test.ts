import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OrgUnitService } from '../org-unit.service';

// --- Mocks ---

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

// --- Mock helpers ---

/**
 * Creates a mock Drizzle DB where every chain method returns the chain itself,
 * and the chain is thenable. Each `await` on the chain pops the next value
 * from a FIFO queue (pushed via `_enqueue`). If empty, resolves to `undefined`.
 */
function createMockDb() {
  const resolveQueue: unknown[] = [];

  const mockChain: Record<string, any> = {
    _enqueue: (...values: unknown[]) => { resolveQueue.push(...values); },
  };

  const methods = [
    'select', 'from', 'innerJoin', 'leftJoin', 'where', 'limit', 'offset',
    'orderBy', 'groupBy', 'insert', 'values', 'returning', 'update', 'set',
    'delete', 'onConflictDoNothing',
  ];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  // Thenable: each await consumes one queued value
  mockChain.then = (
    resolve: (v: unknown) => void,
    _reject?: (e: unknown) => void,
  ) => {
    const value = resolveQueue.length > 0 ? resolveQueue.shift() : undefined;
    resolve(value);
  };

  // execute() for raw SQL queries
  mockChain.execute = vi.fn().mockResolvedValue({ rows: [] });

  return { db: mockChain, _chain: mockChain };
}

function createService() {
  const { db, _chain } = createMockDb();
  const service = new OrgUnitService({ db } as any);
  return { service, db, _chain };
}

// --- Fixtures ---

const now = new Date('2026-01-15T10:00:00.000Z');

function makeOrgUnit(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'ou-1',
    name: 'Engineering',
    parentId: null,
    type: 'team',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// --- Tests ---

describe('OrgUnitService', () => {
  let service: OrgUnitService;
  let db: ReturnType<typeof createMockDb>['db'];
  let _chain: ReturnType<typeof createMockDb>['_chain'];

  beforeEach(() => {
    vi.clearAllMocks();
    ({ service, db, _chain } = createService());
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should insert an org unit and return it', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);

      const result = await service.create({ name: 'Engineering' });

      expect(result).toEqual(unit);
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalled();
      expect(db.returning).toHaveBeenCalled();
    });

    it('should default type to "team" when not provided', async () => {
      const unit = makeOrgUnit({ type: 'team' });
      _chain._enqueue([unit]);

      await service.create({ name: 'Sales' });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.type).toBe('team');
    });

    it('should use provided type when specified', async () => {
      const unit = makeOrgUnit({ type: 'department' });
      _chain._enqueue([unit]);

      await service.create({ name: 'HR', type: 'department' });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.type).toBe('department');
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);

      await service.create({ name: 'Marketing' });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.sortOrder).toBe(0);
    });

    it('should use provided sortOrder when specified', async () => {
      const unit = makeOrgUnit({ sortOrder: 5 });
      _chain._enqueue([unit]);

      await service.create({ name: 'Marketing', sortOrder: 5 });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.sortOrder).toBe(5);
    });

    it('should set parentId to null when not provided', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);

      await service.create({ name: 'Root' });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.parentId).toBeNull();
    });

    it('should set parentId when provided', async () => {
      const unit = makeOrgUnit({ parentId: 'parent-1' });
      _chain._enqueue([unit]);

      await service.create({ name: 'Sub-team', parentId: 'parent-1' });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.parentId).toBe('parent-1');
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('should return all org units with member counts', async () => {
      const units = [
        makeOrgUnit({ id: 'ou-1', name: 'Engineering', memberCount: 5 }),
        makeOrgUnit({ id: 'ou-2', name: 'Sales', memberCount: 3 }),
      ];
      _chain._enqueue(units);

      const result = await service.findAll();

      expect(result).toEqual(units);
      expect(result).toHaveLength(2);
    });

    it('should left join on members table', async () => {
      _chain._enqueue([]);

      await service.findAll();

      expect(db.leftJoin).toHaveBeenCalled();
    });

    it('should group by org unit id', async () => {
      _chain._enqueue([]);

      await service.findAll();

      expect(db.groupBy).toHaveBeenCalled();
    });

    it('should order by sortOrder', async () => {
      _chain._enqueue([]);

      await service.findAll();

      expect(db.orderBy).toHaveBeenCalled();
    });

    it('should return empty array when no org units exist', async () => {
      _chain._enqueue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOneOrFail
  // ---------------------------------------------------------------------------

  describe('findOneOrFail', () => {
    it('should return the org unit if found', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);

      const result = await service.findOneOrFail('ou-1');

      expect(result).toEqual(unit);
    });

    it('should throw NotFoundException if not found', async () => {
      _chain._enqueue([]);

      await expect(service.findOneOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      _chain._enqueue([]);

      await expect(service.findOneOrFail('nonexistent')).rejects.toThrow('Org unit not found');
    });

    it('should apply limit(1) to the query', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);

      await service.findOneOrFail('ou-1');

      expect(db.limit).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should update and return the org unit', async () => {
      const existing = makeOrgUnit();
      const updated = makeOrgUnit({ name: 'Engineering v2' });
      // First enqueue: findOneOrFail
      _chain._enqueue([existing]);
      // Second enqueue: update...returning
      _chain._enqueue([updated]);

      const result = await service.update('ou-1', { name: 'Engineering v2' });

      expect(result).toEqual(updated);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
      expect(db.returning).toHaveBeenCalled();
    });

    it('should call findOneOrFail before updating', async () => {
      _chain._enqueue([]);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
      // update should not have been called since findOneOrFail threw
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should pass update data to set()', async () => {
      const existing = makeOrgUnit();
      const updated = makeOrgUnit({ name: 'New Name', sortOrder: 10 });
      _chain._enqueue([existing]);
      _chain._enqueue([updated]);

      const updateData = { name: 'New Name', sortOrder: 10 };
      await service.update('ou-1', updateData);

      expect(db.set).toHaveBeenCalledWith(updateData);
    });

    it('should update parentId to null', async () => {
      const existing = makeOrgUnit({ parentId: 'parent-1' });
      const updated = makeOrgUnit({ parentId: null });
      _chain._enqueue([existing]);
      _chain._enqueue([updated]);

      await service.update('ou-1', { parentId: null });

      expect(db.set).toHaveBeenCalledWith({ parentId: null });
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete members first, then the org unit', async () => {
      const unit = makeOrgUnit();
      // findOneOrFail
      _chain._enqueue([unit]);
      // delete members (returns chain, awaited)
      _chain._enqueue(undefined);
      // delete org unit (returns chain, awaited)
      _chain._enqueue(undefined);

      await service.delete('ou-1');

      expect(db.delete).toHaveBeenCalledTimes(2);
    });

    it('should call findOneOrFail before deleting', async () => {
      _chain._enqueue([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('should return void on success', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);
      _chain._enqueue(undefined);
      _chain._enqueue(undefined);

      const result = await service.delete('ou-1');

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // addMember
  // ---------------------------------------------------------------------------

  describe('addMember', () => {
    it('should add a member to an org unit', async () => {
      const unit = makeOrgUnit();
      // findOneOrFail
      _chain._enqueue([unit]);
      // insert...onConflictDoNothing
      _chain._enqueue(undefined);

      await service.addMember('ou-1', 'user-1');

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith({
        orgUnitId: 'ou-1',
        userId: 'user-1',
        positionId: null,
      });
      expect(db.onConflictDoNothing).toHaveBeenCalled();
    });

    it('should add a member with a position', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);
      _chain._enqueue(undefined);

      await service.addMember('ou-1', 'user-1', 'pos-1');

      expect(db.values).toHaveBeenCalledWith({
        orgUnitId: 'ou-1',
        userId: 'user-1',
        positionId: 'pos-1',
      });
    });

    it('should default positionId to null when not provided', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);
      _chain._enqueue(undefined);

      await service.addMember('ou-1', 'user-2');

      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({ positionId: null }),
      );
    });

    it('should call findOneOrFail before inserting', async () => {
      _chain._enqueue([]);

      await expect(service.addMember('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should use onConflictDoNothing for idempotent adds', async () => {
      const unit = makeOrgUnit();
      _chain._enqueue([unit]);
      _chain._enqueue(undefined);

      await service.addMember('ou-1', 'user-1');

      expect(db.onConflictDoNothing).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateMemberPosition
  // ---------------------------------------------------------------------------

  describe('updateMemberPosition', () => {
    it('should update the member position', async () => {
      _chain._enqueue(undefined);

      await service.updateMemberPosition('ou-1', 'user-1', 'pos-2');

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith({ positionId: 'pos-2' });
    });

    it('should set positionId to null to remove position', async () => {
      _chain._enqueue(undefined);

      await service.updateMemberPosition('ou-1', 'user-1', null as any);

      expect(db.set).toHaveBeenCalledWith({ positionId: null });
    });

    it('should filter by orgUnitId and userId', async () => {
      _chain._enqueue(undefined);

      await service.updateMemberPosition('ou-1', 'user-1', 'pos-1');

      expect(db.where).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember
  // ---------------------------------------------------------------------------

  describe('removeMember', () => {
    it('should delete the member by orgUnitId and userId', async () => {
      _chain._enqueue(undefined);

      await service.removeMember('ou-1', 'user-1');

      expect(db.delete).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });

    it('should return void on success', async () => {
      _chain._enqueue(undefined);

      const result = await service.removeMember('ou-1', 'user-1');

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getMemberIds
  // ---------------------------------------------------------------------------

  describe('getMemberIds', () => {
    it('should return user IDs for the given org unit', async () => {
      const rows = [{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-3' }];
      _chain._enqueue(rows);

      const result = await service.getMemberIds('ou-1');

      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should return empty array when no members exist', async () => {
      _chain._enqueue([]);

      const result = await service.getMemberIds('ou-1');

      expect(result).toEqual([]);
    });

    it('should query from orgUnitMembers table', async () => {
      _chain._enqueue([]);

      await service.getMemberIds('ou-1');

      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getVisibleOrgUnitIds
  // ---------------------------------------------------------------------------

  describe('getVisibleOrgUnitIds', () => {
    it('should return org unit IDs from the recursive CTE query', async () => {
      db.execute.mockResolvedValueOnce({
        rows: [{ id: 'ou-1' }, { id: 'ou-2' }, { id: 'ou-3' }],
      });

      const result = await service.getVisibleOrgUnitIds('user-1');

      expect(result).toEqual(['ou-1', 'ou-2', 'ou-3']);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should return empty array when user has no org unit memberships', async () => {
      db.execute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getVisibleOrgUnitIds('user-1');

      expect(result).toEqual([]);
    });

    it('should use raw SQL for recursive CTE', async () => {
      db.execute.mockResolvedValueOnce({ rows: [{ id: 'ou-1' }] });

      await service.getVisibleOrgUnitIds('user-1');

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getTeamMemberIds
  // ---------------------------------------------------------------------------

  describe('getTeamMemberIds', () => {
    it('should return member IDs from all visible org units', async () => {
      // getVisibleOrgUnitIds returns org units
      db.execute.mockResolvedValueOnce({
        rows: [{ id: 'ou-1' }, { id: 'ou-2' }],
      });
      // query members from those org units
      _chain._enqueue([{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-3' }]);

      const result = await service.getTeamMemberIds('user-1');

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });

    it('should return only the user themselves when they have no org units', async () => {
      db.execute.mockResolvedValueOnce({ rows: [] });

      const result = await service.getTeamMemberIds('user-1');

      expect(result).toEqual(['user-1']);
    });

    it('should always include the requesting user in results', async () => {
      db.execute.mockResolvedValueOnce({
        rows: [{ id: 'ou-1' }],
      });
      // members query returns other users but not user-1
      _chain._enqueue([{ userId: 'user-2' }, { userId: 'user-3' }]);

      const result = await service.getTeamMemberIds('user-1');

      expect(result).toContain('user-1');
      expect(result).toContain('user-2');
      expect(result).toContain('user-3');
    });

    it('should deduplicate user IDs across org units', async () => {
      db.execute.mockResolvedValueOnce({
        rows: [{ id: 'ou-1' }, { id: 'ou-2' }],
      });
      // user-2 appears in both org units
      _chain._enqueue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      const result = await service.getTeamMemberIds('user-1');

      const uniqueIds = new Set(result);
      expect(uniqueIds.size).toBe(result.length);
    });

    it('should not query members when no visible org units exist', async () => {
      db.execute.mockResolvedValueOnce({ rows: [] });

      await service.getTeamMemberIds('user-1');

      // select should not be called for members query
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
