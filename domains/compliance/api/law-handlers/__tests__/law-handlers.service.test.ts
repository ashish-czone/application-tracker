import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LawHandlersService } from '../law-handlers.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockInsertReturning(row: unknown) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([row]);
  return chain;
}

function mockDeleteWhere() {
  const chain: AnyChain = {} as AnyChain;
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

function mockSelectCount(count: number) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([{ count }]);
  return chain;
}

function mockSelectRows(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

describe('LawHandlersService', () => {
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let service: LawHandlersService;

  beforeEach(() => {
    db = {
      db: {
        insert: vi.fn(),
        delete: vi.fn(),
        select: vi.fn(),
      },
    };
    // crud / entityService / LawsService aren't exercised by the programmatic
    // methods under test (createHandler / deleteHandler / hasDefaultHandler).
    const crud = {} as never;
    const entityService = {} as never;
    const lawsService = {} as never;
    service = new LawHandlersService(crud, entityService, db as never, lawsService);
  });

  describe('createHandler', () => {
    it('inserts with defaults when isPrimary and clientId omitted', async () => {
      const insertChain = mockInsertReturning({
        id: 'h1',
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: null,
        isPrimary: false,
      });
      db.db.insert.mockReturnValue(insertChain);

      const result = await service.createHandler({ lawId: 'l1', orgEntityId: 'o1' });

      expect(insertChain.values).toHaveBeenCalledWith({
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: null,
        isPrimary: false,
      });
      expect(result.clientId).toBeNull();
      expect(result.isPrimary).toBe(false);
    });

    it('passes through clientId and isPrimary when provided', async () => {
      const insertChain = mockInsertReturning({
        id: 'h2',
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: 'c1',
        isPrimary: true,
      });
      db.db.insert.mockReturnValue(insertChain);

      await service.createHandler({ lawId: 'l1', orgEntityId: 'o1', clientId: 'c1', isPrimary: true });

      expect(insertChain.values).toHaveBeenCalledWith({
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: 'c1',
        isPrimary: true,
      });
    });
  });

  describe('deleteHandler', () => {
    it('calls delete with eq on id', async () => {
      const deleteChain = mockDeleteWhere();
      db.db.delete.mockReturnValue(deleteChain);

      await service.deleteHandler('h1');

      expect(db.db.delete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByLaw', () => {
    it('returns mapped rows for the given law', async () => {
      const selectChain = mockSelectRows([
        { id: 'h1', lawId: 'l1', orgEntityId: 'o1', clientId: null, isPrimary: true },
        { id: 'h2', lawId: 'l1', orgEntityId: 'o2', clientId: 'c1', isPrimary: false },
      ]);
      db.db.select.mockReturnValue(selectChain);

      const result = await service.findByLaw('l1');

      expect(result).toHaveLength(2);
      expect(result[0]?.isPrimary).toBe(true);
      expect(result[1]?.clientId).toBe('c1');
    });

    it('returns empty array when no handlers exist', async () => {
      db.db.select.mockReturnValue(mockSelectRows([]));
      expect(await service.findByLaw('l1')).toEqual([]);
    });
  });

  describe('hasDefaultHandler', () => {
    it('returns true when at least one global handler exists', async () => {
      db.db.select.mockReturnValue(mockSelectCount(2));
      expect(await service.hasDefaultHandler('l1')).toBe(true);
    });

    it('returns false when no global handler exists', async () => {
      db.db.select.mockReturnValue(mockSelectCount(0));
      expect(await service.hasDefaultHandler('l1')).toBe(false);
    });

    it('returns false when select returns empty rows', async () => {
      const chain: AnyChain = {} as AnyChain;
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockResolvedValue([]);
      db.db.select.mockReturnValue(chain);
      expect(await service.hasDefaultHandler('l1')).toBe(false);
    });
  });
});
