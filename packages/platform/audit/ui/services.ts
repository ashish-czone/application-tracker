import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui';
import type { AuditLogEntry, ListAuditLogsParams } from './types';

export function createAuditApi(api: ApiFn) {
  return {
    listAuditLogs(params: ListAuditLogsParams): Promise<PaginatedResponse<AuditLogEntry>> {
      const searchParams = new URLSearchParams();
      if (params.page && params.page > 1) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.entityType) searchParams.set('entityType', params.entityType);
      if (params.entityId) searchParams.set('entityId', params.entityId);
      if (params.actorId) searchParams.set('actorId', params.actorId);
      if (params.action) searchParams.set('action', params.action);
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<AuditLogEntry>>(`/audit-logs${qs ? `?${qs}` : ''}`);
    },
  };
}

export type AuditUiApi = ReturnType<typeof createAuditApi>;
