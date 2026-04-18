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

function mockUpdateWhere() {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

interface TxMock {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

describe('ClientContactsService', () => {
  let db: { db: { transaction: ReturnType<typeof vi.fn> } };
  let service: ClientContactsService;

  beforeEach(() => {
    db = { db: { transaction: vi.fn() } };
    service = new ClientContactsService(db as never);
  });

  describe('setPrimary', () => {
    it('unsets existing primary and sets new primary in one transaction', async () => {
      const selectChain = mockSelectReturning([
        { id: 'ct-2', clientId: 'cid-1', name: 'Bob', isPrimary: false },
      ]);
      const unsetChain = mockUpdateWhere();
      const setChain = mockUpdateWhere();

      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValueOnce(unsetChain).mockReturnValueOnce(setChain),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.setPrimary('cid-1', 'ct-2');

      expect(db.db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.update).toHaveBeenCalledTimes(2);
      expect(unsetChain.set).toHaveBeenCalledWith({ isPrimary: false });
      expect(setChain.set).toHaveBeenCalledWith({ isPrimary: true });
    });

    it('no-ops when target contact is already primary', async () => {
      const selectChain = mockSelectReturning([
        { id: 'ct-1', clientId: 'cid-1', name: 'Alice', isPrimary: true },
      ]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.setPrimary('cid-1', 'ct-1');

      expect(tx.update).not.toHaveBeenCalled();
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
});
