import type { DomainEvent } from '@packages/events';

export const EVALUATIONS_EVALUATION_SUBMITTED = 'evaluations.EvaluationSubmitted' as const;
export const EVALUATIONS_EVALUATION_UPDATED = 'evaluations.EvaluationUpdated' as const;
export const EVALUATIONS_EVALUATION_DELETED = 'evaluations.EvaluationDeleted' as const;

// --- Payload types ---

export interface EvaluationSubmittedPayload {
  targetEntityType: string;
  targetEntityId: string;
  evaluatorId: string;
  templateId: string;
  templateSlug: string;
  overallRating: number;
  scores: { criteriaName: string; score: number }[];
  [key: string]: unknown;
}

export interface EvaluationUpdatedPayload {
  targetEntityType: string;
  targetEntityId: string;
  evaluatorId: string;
  templateId: string;
  before: { overallRating: number; recommendation: string | null; comment: string | null };
  after: { overallRating: number; recommendation: string | null; comment: string | null };
  [key: string]: unknown;
}

export interface EvaluationDeletedPayload {
  targetEntityType: string;
  targetEntityId: string;
  evaluatorId: string;
  templateId: string;
  [key: string]: unknown;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [EVALUATIONS_EVALUATION_SUBMITTED]: EvaluationSubmittedPayload;
    [EVALUATIONS_EVALUATION_UPDATED]: EvaluationUpdatedPayload;
    [EVALUATIONS_EVALUATION_DELETED]: EvaluationDeletedPayload;
  }
}

// --- Full event interfaces (for consumers/listeners) ---

export interface EvaluationSubmittedEvent extends DomainEvent {
  eventName: typeof EVALUATIONS_EVALUATION_SUBMITTED;
  entityType: 'evaluations';
  payload: EvaluationSubmittedPayload;
}

export interface EvaluationUpdatedEvent extends DomainEvent {
  eventName: typeof EVALUATIONS_EVALUATION_UPDATED;
  entityType: 'evaluations';
  payload: EvaluationUpdatedPayload;
}

export interface EvaluationDeletedEvent extends DomainEvent {
  eventName: typeof EVALUATIONS_EVALUATION_DELETED;
  entityType: 'evaluations';
  payload: EvaluationDeletedPayload;
}
