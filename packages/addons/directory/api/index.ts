import { DirectoryModule } from './directory.module';

export { DirectoryModule };

export const directoryAddon = {
  module: DirectoryModule,
  migration: '@packages/directory',
} as const;

export { ClientsService } from './services/clients.service';
export type { FindOrCreateClientInput, UpdateClientInput } from './services/clients.service';
export { ClientContactsService } from './services/client-contacts.service';
export type { FindOrCreateClientContactInput, UpdateClientContactInput } from './services/client-contacts.service';

export { DIRECTORY_PERMISSIONS } from './permissions';
export type { DirectoryPermission } from './permissions';

export { clients, baseClientColumns, clientContacts } from './schema';
export type { Client, NewClient, ClientContact, NewClientContact } from './schema';

export {
  DIRECTORY_CLIENT_CREATED,
  DIRECTORY_CLIENT_UPDATED,
  DIRECTORY_CLIENT_MERGED,
  DIRECTORY_CLIENT_CONTACT_CREATED,
  DIRECTORY_CLIENT_CONTACT_UPDATED,
  DIRECTORY_CLIENT_CONTACT_MERGED,
} from './events/types';
export type {
  ClientCreatedPayload,
  ClientUpdatedPayload,
  ClientMergedPayload,
  ClientContactCreatedPayload,
  ClientContactUpdatedPayload,
  ClientContactMergedPayload,
  ClientCreatedEvent,
  ClientUpdatedEvent,
  ClientMergedEvent,
  ClientContactCreatedEvent,
  ClientContactUpdatedEvent,
  ClientContactMergedEvent,
} from './events/types';
