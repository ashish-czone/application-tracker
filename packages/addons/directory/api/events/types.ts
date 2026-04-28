import type { DomainEvent } from '@packages/events';
import type { Company, Person } from '../schema';

export const DIRECTORY_COMPANY_CREATED = 'directory.CompanyCreated' as const;
export const DIRECTORY_COMPANY_UPDATED = 'directory.CompanyUpdated' as const;
export const DIRECTORY_COMPANY_MERGED = 'directory.CompanyMerged' as const;
export const DIRECTORY_PERSON_CREATED = 'directory.PersonCreated' as const;
export const DIRECTORY_PERSON_UPDATED = 'directory.PersonUpdated' as const;
export const DIRECTORY_PERSON_MERGED = 'directory.PersonMerged' as const;

// --- Payloads ---

export interface CompanyCreatedPayload {
  companyId: string;
  name: string;
  websiteDomain: string | null;
  [key: string]: unknown;
}

export interface CompanyUpdatedPayload {
  companyId: string;
  before: Partial<Company>;
  after: Partial<Company>;
  [key: string]: unknown;
}

export interface CompanyMergedPayload {
  loserId: string;
  winnerId: string;
  mergedBy: string;
  [key: string]: unknown;
}

export interface PersonCreatedPayload {
  personId: string;
  fullName: string;
  primaryEmail: string | null;
  [key: string]: unknown;
}

export interface PersonUpdatedPayload {
  personId: string;
  before: Partial<Person>;
  after: Partial<Person>;
  [key: string]: unknown;
}

export interface PersonMergedPayload {
  loserId: string;
  winnerId: string;
  mergedBy: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [DIRECTORY_COMPANY_CREATED]: CompanyCreatedPayload;
    [DIRECTORY_COMPANY_UPDATED]: CompanyUpdatedPayload;
    [DIRECTORY_COMPANY_MERGED]: CompanyMergedPayload;
    [DIRECTORY_PERSON_CREATED]: PersonCreatedPayload;
    [DIRECTORY_PERSON_UPDATED]: PersonUpdatedPayload;
    [DIRECTORY_PERSON_MERGED]: PersonMergedPayload;
  }
}

// --- Full event interfaces ---

export interface CompanyCreatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_COMPANY_CREATED;
  entityType: 'companies';
  payload: CompanyCreatedPayload;
}

export interface CompanyUpdatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_COMPANY_UPDATED;
  entityType: 'companies';
  payload: CompanyUpdatedPayload;
}

export interface CompanyMergedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_COMPANY_MERGED;
  entityType: 'companies';
  payload: CompanyMergedPayload;
}

export interface PersonCreatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_PERSON_CREATED;
  entityType: 'people';
  payload: PersonCreatedPayload;
}

export interface PersonUpdatedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_PERSON_UPDATED;
  entityType: 'people';
  payload: PersonUpdatedPayload;
}

export interface PersonMergedEvent extends DomainEvent {
  eventName: typeof DIRECTORY_PERSON_MERGED;
  entityType: 'people';
  payload: PersonMergedPayload;
}
