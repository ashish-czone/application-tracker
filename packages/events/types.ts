export interface DomainEvent {
  eventName: string;
  entityType: string;
  entityId: string;
  actorId: string;
  correlationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}
