import type { DomainEvent } from '@packages/events';

export const CANDIDATES_CANDIDATE_CREATED = 'candidates.CandidateCreated' as const;
export const CANDIDATES_CANDIDATE_UPDATED = 'candidates.CandidateUpdated' as const;
export const CANDIDATES_CANDIDATE_DELETED = 'candidates.CandidateDeleted' as const;

// --- Payload types ---

export interface CandidateSnapshot {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  country: string | null;
  highestQualification: string | null;
  [key: string]: unknown;
}

export interface CandidateCreatedPayload {
  firstName: string;
  lastName: string;
  email: string;
  source: string | null;
  after: CandidateSnapshot;
  [key: string]: unknown;
}

export interface CandidateUpdatedPayload {
  changes: string[];
  before: CandidateSnapshot;
  after: CandidateSnapshot;
  [key: string]: unknown;
}

export interface CandidateDeletedPayload {
  firstName: string;
  lastName: string;
  email: string;
  before: CandidateSnapshot;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [CANDIDATES_CANDIDATE_CREATED]: CandidateCreatedPayload;
    [CANDIDATES_CANDIDATE_UPDATED]: CandidateUpdatedPayload;
    [CANDIDATES_CANDIDATE_DELETED]: CandidateDeletedPayload;
  }
}

// --- Full event interfaces ---

export interface CandidateCreatedEvent extends DomainEvent {
  eventName: typeof CANDIDATES_CANDIDATE_CREATED;
  entityType: 'candidates';
  payload: CandidateCreatedPayload;
}

export interface CandidateUpdatedEvent extends DomainEvent {
  eventName: typeof CANDIDATES_CANDIDATE_UPDATED;
  entityType: 'candidates';
  payload: CandidateUpdatedPayload;
}

export interface CandidateDeletedEvent extends DomainEvent {
  eventName: typeof CANDIDATES_CANDIDATE_DELETED;
  entityType: 'candidates';
  payload: CandidateDeletedPayload;
}
