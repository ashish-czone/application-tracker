import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientsController } from '../clients.controller';
import type { ClientsService } from '../clients.service';
import type { ClientContactsService } from '../../client-contacts/client-contacts.service';
import type { ClientRegistrationsService } from '../../client-registrations/client-registrations.service';

describe('ClientsController', () => {
  let clientsService: { createWithContacts: ReturnType<typeof vi.fn> };
  let contactsService: { setPrimary: ReturnType<typeof vi.fn> };
  let registrationsService: {
    registerMany: ReturnType<typeof vi.fn>;
    previewDeactivation: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };
  let controller: ClientsController;

  beforeEach(() => {
    clientsService = { createWithContacts: vi.fn().mockResolvedValue({ client: {}, contacts: [] }) };
    contactsService = { setPrimary: vi.fn().mockResolvedValue(undefined) };
    registrationsService = {
      registerMany: vi.fn().mockResolvedValue([]),
      previewDeactivation: vi.fn().mockResolvedValue({ registrationId: 'r1', deactivatedAt: '', cancelledAfter: 0, remainingBefore: 0 }),
      deactivate: vi.fn().mockResolvedValue({ registrationId: 'r1', deactivatedAt: '', autoCancelledFilingIds: [], manuallyCancelledFilingIds: [] }),
    };
    controller = new ClientsController(
      clientsService as unknown as ClientsService,
      contactsService as unknown as ClientContactsService,
      registrationsService as unknown as ClientRegistrationsService,
    );
  });

  describe('createWithContacts', () => {
    it('delegates to ClientsService.createWithContacts and parses onboardedAt', async () => {
      const dto = {
        client: { name: 'Acme', legalName: 'Acme Pvt.', onboardedAt: '2026-04-01T00:00:00.000Z' },
        contacts: [{ name: 'Alice', isPrimary: true }],
      } as never;

      await controller.createWithContacts(dto, { userId: 'user-1' } as never);

      const arg = clientsService.createWithContacts.mock.calls[0][0];
      expect(arg.client.name).toBe('Acme');
      expect(arg.client.onboardedAt).toBeInstanceOf(Date);
      expect((arg.client.onboardedAt as Date).toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(arg.contacts).toHaveLength(1);
    });

    it('passes onboardedAt as null when absent', async () => {
      const dto = {
        client: { name: 'Acme', legalName: 'Acme Pvt.' },
        contacts: [{ name: 'Alice', isPrimary: true }],
      } as never;

      await controller.createWithContacts(dto, { userId: 'user-1' } as never);

      expect(clientsService.createWithContacts.mock.calls[0][0].client.onboardedAt).toBeNull();
    });

    it('requires clients.create permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ClientsController.prototype.createWithContacts,
      );
      expect(permission).toBe('clients.create');
    });
  });

  describe('setPrimaryContact', () => {
    it('delegates to ClientContactsService.setPrimary', async () => {
      await controller.setPrimaryContact('cid-1', 'ct-1', { userId: 'user-1' } as never);
      expect(contactsService.setPrimary).toHaveBeenCalledWith('cid-1', 'ct-1', 'user-1');
    });

    it('requires client-contacts.update permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ClientsController.prototype.setPrimaryContact,
      );
      expect(permission).toBe('client-contacts.update');
    });
  });

  describe('createRegistrations', () => {
    it('delegates to ClientRegistrationsService.registerMany with the actor id', async () => {
      registrationsService.registerMany.mockResolvedValue([
        { id: 'r1', clientId: 'cid-1', lawId: 'l1', registeredAt: new Date(), deactivatedAt: null },
      ]);

      const result = await controller.createRegistrations(
        'cid-1',
        { lawCodes: ['GST', 'ITR'] },
        { userId: 'user-1' } as never,
      );

      expect(registrationsService.registerMany).toHaveBeenCalledWith(
        'cid-1',
        ['GST', 'ITR'],
        'user-1',
      );
      expect(result).toHaveLength(1);
    });

    it('requires client-registrations.create permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ClientsController.prototype.createRegistrations,
      );
      expect(permission).toBe('client-registrations.create');
    });
  });

  describe('previewDeactivation', () => {
    it('parses the query date and delegates to the service', async () => {
      await controller.previewDeactivation('cid-1', 'law-1', '2026-03-01');
      const args = registrationsService.previewDeactivation.mock.calls[0];
      expect(args[0]).toBe('cid-1');
      expect(args[1]).toBe('law-1');
      expect(args[2]).toBeInstanceOf(Date);
      expect((args[2] as Date).toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('rejects missing date with 400', async () => {
      await expect(controller.previewDeactivation('cid-1', 'law-1', undefined)).rejects.toThrow();
    });

    it('rejects an unparseable date with 400', async () => {
      await expect(controller.previewDeactivation('cid-1', 'law-1', 'not-a-date')).rejects.toThrow();
    });

    it('requires client-registrations.delete permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ClientsController.prototype.previewDeactivation,
      );
      expect(permission).toBe('client-registrations.delete');
    });
  });

  describe('deactivateRegistration', () => {
    it('passes through the DTO + actor id', async () => {
      await controller.deactivateRegistration(
        'cid-1',
        'law-1',
        { deactivatedAt: '2026-03-01T00:00:00Z', alsoCancelEarlier: true, comment: 'stop' },
        { userId: 'user-1' } as never,
      );
      const args = registrationsService.deactivate.mock.calls[0];
      expect(args[0]).toBe('cid-1');
      expect(args[1]).toBe('law-1');
      expect(args[2].deactivatedAt).toBeInstanceOf(Date);
      expect(args[2].alsoCancelEarlier).toBe(true);
      expect(args[2].actorId).toBe('user-1');
      expect(args[2].comment).toBe('stop');
    });

    it('requires client-registrations.delete permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ClientsController.prototype.deactivateRegistration,
      );
      expect(permission).toBe('client-registrations.delete');
    });
  });
});
