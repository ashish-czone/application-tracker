import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { OrgUnitLevelService } from '../org-unit-level.service';

// --- Mocks ---

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

// --- Mock helpers ---

function createMockDb() {
  const resolveQueue: unknown[] = [];

  const mockChain: Record<string, any> = {
    _enqueue: (...values: unknown[]) => { resolveQueue.push(...values); },
  };

  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'returning', 'update', 'set', 'delete',
  ];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  mockChain.then = (
    resolve: (v: unknown) => void,
    _reject?: (e: unknown) => void,
  ) => {
    const value = resolveQueue.length > 0 ? resolveQueue.shift() : undefined;
    resolve(value);
  };

  return { db: mockChain, _chain: mockChain };
}

function createService() {
  const { db, _chain } = createMockDb();
  const service = new OrgUnitLevelService({ db } as any);
  return { service, db, _chain };
}

// --- Fixtures ---

const now = new Date('2026-01-15T10:00:00.000Z');

function makeLevel(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'lvl-1',
    name: 'Company',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// --- Tests ---

describe('OrgUnitLevelService', () => {
  let service: OrgUnitLevelService;
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
    it('should insert a level and return it', async () => {
      const level = makeLevel();
      _chain._enqueue([level]);

      const result = await service.create({ name: 'Company' });

      expect(result).toEqual(level);
      expect(db.insert).toHaveBeenCalled();
      expect(db.returning).toHaveBeenCalled();
    });

    it('should default sortOrder to 0', async () => {
      const level = makeLevel();
      _chain._enqueue([level]);

      await service.create({ name: 'Company' });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.sortOrder).toBe(0);
    });

    it('should use provided sortOrder', async () => {
      const level = makeLevel({ sortOrder: 3 });
      _chain._enqueue([level]);

      await service.create({ name: 'Team', sortOrder: 3 });

      const valuesArg = db.values.mock.calls[0][0];
      expect(valuesArg.sortOrder).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('should return all levels ordered by sortOrder', async () => {
      const levels = [makeLevel(), makeLevel({ id: 'lvl-2', name: 'Entity', sortOrder: 1 })];
      _chain._enqueue(levels);

      const result = await service.findAll();

      expect(result).toEqual(levels);
      expect(db.orderBy).toHaveBeenCalled();
    });

    it('should return empty array when none exist', async () => {
      _chain._enqueue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOneOrFail
  // ---------------------------------------------------------------------------

  describe('findOneOrFail', () => {
    it('should return the level if found', async () => {
      const level = makeLevel();
      _chain._enqueue([level]);

      const result = await service.findOneOrFail('lvl-1');

      expect(result).toEqual(level);
    });

    it('should throw NotFoundException if not found', async () => {
      _chain._enqueue([]);

      await expect(service.findOneOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('should update and return the level', async () => {
      const existing = makeLevel();
      const updated = makeLevel({ name: 'Corporation' });
      _chain._enqueue([existing]);
      _chain._enqueue([updated]);

      const result = await service.update('lvl-1', { name: 'Corporation' });

      expect(result).toEqual(updated);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith({ name: 'Corporation' });
    });

    it('should throw NotFoundException if level does not exist', async () => {
      _chain._enqueue([]);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete when no units reference the level', async () => {
      const level = makeLevel();
      _chain._enqueue([level]); // findOneOrFail
      _chain._enqueue([{ total: 0 }]); // count check
      _chain._enqueue(undefined); // delete

      await service.delete('lvl-1');

      expect(db.delete).toHaveBeenCalled();
    });

    it('should throw ConflictException when units reference the level', async () => {
      const level = makeLevel();
      _chain._enqueue([level]); // findOneOrFail
      _chain._enqueue([{ total: 3 }]); // count check

      await expect(service.delete('lvl-1')).rejects.toThrow(ConflictException);
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if level does not exist', async () => {
      _chain._enqueue([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // seedDefaults
  // ---------------------------------------------------------------------------

  describe('seedDefaults', () => {
    it('should seed 4 default levels when none exist', async () => {
      _chain._enqueue([]); // existing check returns empty

      await service.seedDefaults();

      expect(db.insert).toHaveBeenCalledTimes(4);
    });

    it('should not seed when levels already exist', async () => {
      _chain._enqueue([{ id: 'existing' }]); // existing check returns result

      await service.seedDefaults();

      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
