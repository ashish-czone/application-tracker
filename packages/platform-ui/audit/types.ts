export interface AuditLogEntry {
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
  targetEntityType: string | null;
  targetEntityId: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  includeRelated?: boolean;
}

export type ActivityEventCategory = 'changes' | 'notes' | 'evaluations' | 'attachments' | 'transitions';
