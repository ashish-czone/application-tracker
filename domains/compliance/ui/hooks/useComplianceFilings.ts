import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';

/**
 * Workflow states for compliance filings. Matches the 6-state state machine
 * declared in `domains/compliance/api/compliance-filings/compliance-filings.config.ts`.
 */
export type ComplianceFilingStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface UpdateComplianceFilingPayload {
  status?: ComplianceFilingStatus;
  priority?: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  dueDate?: string | null;
  title?: string;
}

export function useUpdateComplianceFiling(options?: { silent?: boolean }) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateComplianceFilingPayload }) =>
      apiFn.patch<unknown>(`/compliance-filings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-filings'] });
    },
    onError: (error: unknown) => {
      if (options?.silent) return;
      const message =
        (error as { body?: { message?: string } })?.body?.message ?? 'Failed to update filing';
      toast.error(message);
    },
  });
}
