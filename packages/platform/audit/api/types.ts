export type AuditAction = 'created' | 'updated' | 'deleted' | string;

export interface AuditReadAuthorisationContext {
  user: { userId: string; permissions?: Record<string, string>; [key: string]: unknown };
  entityType: string;
  entityId: string;
}

export interface AuditModuleRegistration {
  events: string[] | '*';
  /** Fields to exclude from audit snapshots (e.g., 'passwordHash') */
  sensitiveFields?: string[];
  /**
   * Called by the per-entity audit read endpoint. Should return true when
   * the user is allowed to see audit rows for `entityId`. Omit to require
   * the `audit.read_all` permission for this module's entities.
   */
  authoriseRead?: (ctx: AuditReadAuthorisationContext) => boolean | Promise<boolean>;
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
  targetEntityType: string | null;
  targetEntityId: string | null;
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
  targetEntityType?: string;
  targetEntityId?: string;
  includeRelated?: boolean;
}
