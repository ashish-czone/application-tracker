import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ClientContactsService } from '../client-contacts.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockUpdateWhere(returningRows: unknown[] = []) {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returningRows);
  return chain;
}

interface TxMock {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

/**
 * After the BaseCrudService migration, the constructor signature is
 * (database, events, appLogger) — entityService is no longer injected.
 * The appLogger mock just needs `.forContext()` to return a logger-shaped
 * object (the base service binds it once at construction).
 */
function makeLoggerMock() {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(logger) };
}

describe('ClientContactsService', () => {
  let db: { db: { transaction: ReturnType<typeof vi.fn> } };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let appLogger: ReturnType<typeof makeLoggerMock>;
  let service: ClientContactsService;

  beforeEach(() => {
    db = { db: { transaction: vi.fn() } };
    events = { emitDynamic: vi.fn() };
    appLogger = makeLoggerMock();
    service = new ClientContactsService(db as never, events as never, appLogger as never);
  });

  describe('setPrimary', () => {
    it('unsets existing primary and sets new primary in one transaction', async () => {
      const existing = { id: 'ct-2', complianceClientId: 'cid-1', fullName: 'Bob', complianceIsPrimary: false };
      const demotedRow = { id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: false };
      const promotedRow = { ...existing, complianceIsPrimary: true };

      const selectChain = mockSelectReturning([existing]);
      const unsetChain = mockUpdateWhere([demotedRow]);
      const setChain = mockUpdateWhere([promotedRow]);

      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValueOnce(unsetChain).mockReturnValueOnce(setChain),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.setPrimary('cid-1', 'ct-2', 'user-1');

      expect(db.db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.update).toHaveBeenCalledTimes(2);
      expect(unsetChain.set).toHaveBeenCalledWith({ complianceIsPrimary: false });
      expect(setChain.set).toHaveBeenCalledWith({ complianceIsPrimary: true });

      expect(events.emitDynamic).toHaveBeenCalledTimes(2);
      expect(events.emitDynamic).toHaveBeenCalledWith('client-contacts.Updated', expect.objectContaining({
        entityId: 'ct-1',
        actorId: 'user-1',
      }));
      expect(events.emitDynamic).toHaveBeenCalledWith('client-contacts.Updated', expect.objectContaining({
        entityId: 'ct-2',
        actorId: 'user-1',
      }));
    });

    it('no-ops when target contact is already primary', async () => {
      const selectChain = mockSelectReturning([
        { id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: true },
      ]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.setPrimary('cid-1', 'ct-1');

      expect(tx.update).not.toHaveBeenCalled();
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('throws NotFound when contact does not exist', async () => {
      const selectChain = mockSelectReturning([]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await expect(service.setPrimary('cid-1', 'ct-missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('emits nothing when the primary flip fails mid-transaction', async () => {
      const existing = { id: 'ct-2', complianceClientId: 'cid-1', fullName: 'Bob', complianceIsPrimary: false };
      const selectChain = mockSelectReturning([existing]);
      const unsetChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('db error')),
      } as unknown as AnyChain;
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValueOnce(unsetChain),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await expect(service.setPrimary('cid-1', 'ct-2')).rejects.toThrow('db error');
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('throws NotFound when contact belongs to a different client', async () => {
      // The where clause scopes on both id AND clientId, so a contact belonging
      // to another client will not be returned by the select above.
      const selectChain = mockSelectReturning([]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await expect(service.setPrimary('cid-1', 'ct-from-other-client')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('hasPrimaryContact', () => {
    it('returns true when a primary contact exists', async () => {
      const limitChain = { then: vi.fn() };
      const whereChain = { limit: vi.fn().mockResolvedValue([{ id: 'ct-1' }]) };
      const fromChain = { where: vi.fn().mockReturnValue(whereChain) };
      const selectChain = { from: vi.fn().mockReturnValue(fromChain) };
      const dbMock = { select: vi.fn().mockReturnValue(selectChain) };
      const s = new ClientContactsService({ db: dbMock } as never, events as never, appLogger as never);
      void limitChain;

      await expect(s.hasPrimaryContact('cid-1')).resolves.toBe(true);
    });

    it('returns false when no primary contact exists', async () => {
      const whereChain = { limit: vi.fn().mockResolvedValue([]) };
      const fromChain = { where: vi.fn().mockReturnValue(whereChain) };
      const selectChain = { from: vi.fn().mockReturnValue(fromChain) };
      const dbMock = { select: vi.fn().mockReturnValue(selectChain) };
      const s = new ClientContactsService({ db: dbMock } as never, events as never, appLogger as never);

      await expect(s.hasPrimaryContact('cid-1')).resolves.toBe(false);
    });
  });
});
