export interface DomainEvent {
  eventName: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  tenantId?: string;
  correlationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

// Modules augment this interface to register their event payload types.
// Example in a module:
//   declare module '@packages/events' {
//     interface EventPayloadMap {
//       [MY_EVENT]: MyPayload;
//     }
//   }
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface EventPayloadMap {}
