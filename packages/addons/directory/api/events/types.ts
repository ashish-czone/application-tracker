import type { DomainEvent } from '@packages/events';
import type { Client, ClientContact } from '../schema';

export const DIRECTORY_CLIENT_CREATED = 'directory.ClientCreated' as const;
export const DIRECTORY_CLIENT_UPDATED = 'directory.ClientUpdated' as const;
export const DIRECTORY_CLIENT_MERGED = 'directory.ClientMerged' as const;
export const DIRECTORY_CLIENT_CONTACT_CREATED = 'directory.ClientContactCreated' as const;
export const DIRECTORY_CLIENT_CONTACT_UPDATED = 'directory.ClientContactUpdated' as const;
export const DIRECTORY_CLIENT_CONTACT_MERGED = 'directory.ClientContactMerged' as const;

// --- Payloads ---

export interface ClientCreatedPayload {
  clientId: string;
  name: string;
  websiteDomain: string | null;
  [key: string]: unknown;
}

export interface ClientUpdatedPayload {
  clientId: string;
  before: Partial<Client>;
  after: Partial<Client>;
  [key: string]: unknown;
}

export interface ClientMergedPayload {
  loserId: string;
  winnerId: string;
  mergedBy: string;
  [key: string]: unknown;
}

export interface ClientContactCreatedPayload {
  clientContactId: string;
  fullName: string;
  primaryEmail: string | null;
  [key: string]: unknown;
}

export interface ClientContactUpdatedPayload {
  clientContactId: string;
  before: Partial<ClientContact>;
  after: Partial<ClientContact>;
  [key: string]: unknown;
}

export interface ClientContactMergedPayload {
  loserId: string;
  winnerId: string;
  mergedBy: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [DIRECTORY_CLIENT_CREATED]: ClientCreatedPayload;
    [DIRECTORY_CLIENT_UPDATED]: ClientUpdatedPayload;
    [DIRECTORY_CLIENT_MERGED]: ClientMergedPayload;
    [DIRECTORY_CLIENT_CONTACT_CREATED]: ClientContactCreatedPayload;
    [DIRECTORY_CLIENT_CONTACT_UPDATED]: ClientContactUpdatedPayload;
    [DIRECTORY_CLIENT_CONTACT_MERGED]: ClientContactMergedPayload;
  }
}

// --- Full event interfaces ---

export interface ClientCreatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_CLIENT_CREATED;
  entityType: 'clients';
  payload: ClientCreatedPayload;
}

export interface ClientUpdatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_CLIENT_UPDATED;
  entityType: 'clients';
  payload: ClientUpdatedPayload;
}

export interface ClientMergedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_CLIENT_MERGED;
  entityType: 'clients';
  payload: ClientMergedPayload;
}

export interface ClientContactCreatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_CLIENT_CONTACT_CREATED;
  entityType: 'client_contacts';
  payload: ClientContactCreatedPayload;
}

export interface ClientContactUpdatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_CLIENT_CONTACT_UPDATED;
  entityType: 'client_contacts';
  payload: ClientContactUpdatedPayload;
}

export interface ClientContactMergedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_CLIENT_CONTACT_MERGED;
  entityType: 'client_contacts';
  payload: ClientContactMergedPayload;
}
