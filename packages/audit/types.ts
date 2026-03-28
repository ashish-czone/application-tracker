export type AuditAction = 'created' | 'updated' | 'deleted' | string;

export interface AuditModuleRegistration {
  events: string[] | '*';
  /** Fields to exclude from audit snapshots (e.g., 'passwordHash') */
  sensitiveFields?: string[];
}

export interface AuditLogRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  eventName: string;
  actorId: string | null;
  actorName?: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  correlationId: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  eventName?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
}
