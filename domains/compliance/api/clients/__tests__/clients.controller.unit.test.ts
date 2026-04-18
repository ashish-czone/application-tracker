import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientsController } from '../clients.controller';
import type { ClientsService } from '../clients.service';
import type { ClientContactsService } from '../../client-contacts/client-contacts.service';
import type { ClientRegistrationService } from '../../client-registrations/client-registrations.service';

describe('ClientsController', () => {
  let clientsService: { createWithContacts: ReturnType<typeof vi.fn> };
  let contactsService: { setPrimary: ReturnType<typeof vi.fn> };
  let registrationsService: { registerMany: ReturnType<typeof vi.fn> };
  let controller: ClientsController;

  beforeEach(() => {
    clientsService = { createWithContacts: vi.fn().mockResolvedValue({ client: {}, contacts: [] }) };
    contactsService = { setPrimary: vi.fn().mockResolvedValue(undefined) };
    registrationsService = { registerMany: vi.fn().mockResolvedValue([]) };
    controller = new ClientsController(
      clientsService as unknown as ClientsService,
      contactsService as unknown as ClientContactsService,
      registrationsService as unknown as ClientRegistrationService,
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
    it('delegates to ClientRegistrationService.registerMany with the actor id', async () => {
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
});
