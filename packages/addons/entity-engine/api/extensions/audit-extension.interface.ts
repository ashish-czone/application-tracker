/**
 * Interface for audit event registration.
 * Implemented by @packages/audit when loaded.
 * When not loaded, entities are not registered for audit logging
 * (but audit logging itself may still work via direct event subscription).
 */
export interface AuditExtension {
  /** Register entity events for audit logging. */
  register(entityType: string, config: { events: string[] }): void;
}

/** NestJS injection token for the audit extension. */
export const AUDIT_EXTENSION = 'AUDIT_EXTENSION';
