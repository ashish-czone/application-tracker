import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';
import { createAuditApi } from './services';
import type { ListAuditLogsParams } from './types';

function useAuditApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createAuditApi(apiFn), [apiFn]);
}

export function useAuditLogs(params: ListAuditLogsParams) {
  const api = useAuditApi();
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.listAuditLogs(params),
    enabled: !!params.entityType && !!params.entityId,
  });
}

export function useEntityActivity(entityType: string, entityId: string, page = 1) {
  return useAuditLogs({
    entityType,
    entityId,
    includeRelated: true,
    page,
    limit: 25,
  });
}
