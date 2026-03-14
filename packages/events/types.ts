export interface DomainEvent {
  eventName: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  correlationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}
