import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientRegistrationService } from '../client-registrations.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectRows(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockInsertReturning(row: unknown) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([row]);
  return chain;
}

function mockUpdate() {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

describe('ClientRegistrationService', () => {
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let service: ClientRegistrationService;

  const activeRow = {
    id: 'reg1',
    clientId: 'c1',
    lawId: 'l1',
    registeredAt: new Date('2026-01-01'),
    deactivatedAt: null,
  };

  beforeEach(() => {
    db = {
      db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new ClientRegistrationService(db as never);
  });

  describe('register', () => {
    it('inserts when no active registration exists', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      const insertChain = mockInsertReturning(activeRow);
      db.db.insert.mockReturnValue(insertChain);

      const result = await service.register('c1', 'l1');

      expect(insertChain.values).toHaveBeenCalledWith({ clientId: 'c1', lawId: 'l1' });
      expect(result.clientId).toBe('c1');
      expect(result.deactivatedAt).toBeNull();
    });

    it('throws ConflictException when active registration already exists', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([activeRow]));
      await expect(service.register('c1', 'l1')).rejects.toBeInstanceOf(ConflictException);
      expect(db.db.insert).not.toHaveBeenCalled();
    });
  });

  describe('deregister', () => {
    it('sets deactivatedAt on the active registration', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([activeRow]));
      const updateChain = mockUpdate();
      db.db.update.mockReturnValue(updateChain);

      await service.deregister('c1', 'l1');

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ deactivatedAt: expect.any(Date) }),
      );
      expect(updateChain.where).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when no active registration exists', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      await expect(service.deregister('c1', 'l1')).rejects.toBeInstanceOf(NotFoundException);
      expect(db.db.update).not.toHaveBeenCalled();
    });
  });

  describe('getRegisteredClients', () => {
    it('returns mapped active registrations for the law', async () => {
      db.db.select.mockReturnValue(mockSelectRows([activeRow, { ...activeRow, id: 'reg2', clientId: 'c2' }]));

      const result = await service.getRegisteredClients('l1');

      expect(result).toHaveLength(2);
      expect(result[0]?.clientId).toBe('c1');
      expect(result[1]?.clientId).toBe('c2');
    });
  });

  describe('getRegisteredLaws', () => {
    it('returns mapped active registrations for the client', async () => {
      db.db.select.mockReturnValue(
        mockSelectRows([activeRow, { ...activeRow, id: 'reg3', lawId: 'l2' }]),
      );

      const result = await service.getRegisteredLaws('c1');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.lawId)).toEqual(['l1', 'l2']);
    });

    it('returns empty array when client has no registrations', async () => {
      db.db.select.mockReturnValue(mockSelectRows([]));
      expect(await service.getRegisteredLaws('c1')).toEqual([]);
    });
  });
});
