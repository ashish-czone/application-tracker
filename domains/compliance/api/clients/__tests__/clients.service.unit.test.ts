import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ClientsService, type ContactInput } from '../clients.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockInsertReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(rows);
  return chain;
}

interface TxMock {
  insert: ReturnType<typeof vi.fn>;
}

function makeTx(clientRow: unknown, contactRows: unknown[]): TxMock {
  const clientInsert = mockInsertReturning([clientRow]);
  const contactInsert = mockInsertReturning(contactRows);
  const insert = vi.fn()
    .mockReturnValueOnce(clientInsert)
    .mockReturnValueOnce(contactInsert);
  return { insert };
}

describe('ClientsService', () => {
  let db: { db: { transaction: ReturnType<typeof vi.fn> } };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let service: ClientsService;

  beforeEach(() => {
    db = { db: { transaction: vi.fn() } };
    events = { emitDynamic: vi.fn() };
    service = new ClientsService(db as never, events as never);
  });

  const validClient = {
    name: 'Acme',
    legalName: 'Acme Pvt. Ltd.',
  };
  const primaryContact: ContactInput = { name: 'Alice', isPrimary: true };
  const secondaryContact: ContactInput = { name: 'Bob', isPrimary: false };

  describe('createWithContacts', () => {
    it('inserts client + contacts in a single transaction and returns both', async () => {
      const clientRow = {
        id: 'cid-1',
        name: 'Acme',
        legalName: 'Acme Pvt. Ltd.',
        status: 'onboarding',
        createdAt: new Date('2026-01-01'),
      };
      const contactRows = [
        { id: 'ct-1', clientId: 'cid-1', name: 'Alice', isPrimary: true },
        { id: 'ct-2', clientId: 'cid-1', name: 'Bob', isPrimary: false },
      ];

      const tx = makeTx(clientRow, contactRows);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      const result = await service.createWithContacts({
        client: validClient,
        contacts: [primaryContact, secondaryContact],
      });

      expect(db.db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(2);
      expect(result.client.id).toBe('cid-1');
      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0].isPrimary).toBe(true);
    });

    it('defaults status to onboarding when not provided', async () => {
      const clientRow = { id: 'cid-1', name: 'Acme', legalName: 'Acme', status: 'onboarding', createdAt: new Date() };
      const tx = makeTx(clientRow, [{ id: 'ct-1', clientId: 'cid-1', name: 'Alice', isPrimary: true }]);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.createWithContacts({ client: validClient, contacts: [primaryContact] });

      const clientInsertValues = (tx.insert.mock.results[0].value as AnyChain).values.mock.calls[0][0] as Record<string, unknown>;
      expect(clientInsertValues.status).toBe('onboarding');
    });

    it('throws BadRequest when contacts is empty', async () => {
      await expect(
        service.createWithContacts({ client: validClient, contacts: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(db.db.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequest when zero contacts are flagged primary', async () => {
      await expect(
        service.createWithContacts({
          client: validClient,
          contacts: [{ name: 'Alice' }, { name: 'Bob' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when multiple contacts are flagged primary', async () => {
      await expect(
        service.createWithContacts({
          client: validClient,
          contacts: [
            { name: 'Alice', isPrimary: true },
            { name: 'Bob', isPrimary: true },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forwards the clientId from the inserted client row into each contact', async () => {
      const clientRow = { id: 'cid-xyz', name: 'Acme', legalName: 'Acme', status: 'onboarding', createdAt: new Date() };
      const tx = makeTx(clientRow, [{ id: 'ct-1', clientId: 'cid-xyz', name: 'Alice', isPrimary: true }]);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.createWithContacts({ client: validClient, contacts: [primaryContact] });

      const contactInsertValues = (tx.insert.mock.results[1].value as AnyChain).values.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(contactInsertValues).toHaveLength(1);
      expect(contactInsertValues[0].clientId).toBe('cid-xyz');
    });

    it('emits clients.Created and one client-contacts.Created per contact', async () => {
      const clientRow = { id: 'cid-1', name: 'Acme', legalName: 'Acme', status: 'onboarding', createdAt: new Date() };
      const contactRows = [
        { id: 'ct-1', clientId: 'cid-1', name: 'Alice', isPrimary: true },
        { id: 'ct-2', clientId: 'cid-1', name: 'Bob', isPrimary: false },
      ];
      const tx = makeTx(clientRow, contactRows);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.createWithContacts(
        { client: validClient, contacts: [primaryContact, secondaryContact] },
        'user-1',
      );

      expect(events.emitDynamic).toHaveBeenCalledTimes(3);
      expect(events.emitDynamic).toHaveBeenNthCalledWith(1, 'clients.Created', expect.objectContaining({
        entityType: 'clients',
        entityId: 'cid-1',
        actorId: 'user-1',
        payload: expect.objectContaining({ after: clientRow }),
      }));
      expect(events.emitDynamic).toHaveBeenNthCalledWith(2, 'client-contacts.Created', expect.objectContaining({
        entityType: 'client-contacts',
        entityId: 'ct-1',
      }));
      expect(events.emitDynamic).toHaveBeenNthCalledWith(3, 'client-contacts.Created', expect.objectContaining({
        entityType: 'client-contacts',
        entityId: 'ct-2',
      }));
    });

    it('does not emit when validation fails', async () => {
      await expect(
        service.createWithContacts({ client: validClient, contacts: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });
  });
});
