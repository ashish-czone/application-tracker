import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useAuth } from '@packages/platform-ui/auth/hooks/useAuth';
import { usePlatformAPI } from '@packages/platform-ui';
import type { CellRendererProps } from '@packages/ui/components/data-grid/cell-renderers/types';

export function TaskClaimedByCell({ row }: CellRendererProps) {
  const { user } = useAuth();
  const api = usePlatformAPI();
  const queryClient = useQueryClient();

  const isTeamTask = !!row.assigneeTeamId;
  const claimedById = row.claimedById as string | null;
  const claimedByName = row.claimedById__label as string | undefined;
  const isClaimedByMe = claimedById === user?.userId;

  const claimMutation = useMutation({
    mutationFn: () => api.post(`/tasks/${row.id}/claim`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task claimed');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to claim task');
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: () => api.post(`/tasks/${row.id}/unclaim`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task released');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to release task');
    },
  });

  const handleClaim = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    claimMutation.mutate();
  }, [claimMutation]);

  const handleUnclaim = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    unclaimMutation.mutate();
  }, [unclaimMutation]);

  // Not a team task — not applicable
  if (!isTeamTask) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  // Claimed by current user — show name + release
  if (isClaimedByMe) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm truncate">{claimedByName ?? 'You'}</span>
        <button
          type="button"
          onClick={handleUnclaim}
          disabled={unclaimMutation.isPending}
          className="text-xs text-primary hover:underline shrink-0"
        >
          {unclaimMutation.isPending ? '...' : 'Release'}
        </button>
      </div>
    );
  }

  // Claimed by someone else
  if (claimedById) {
    return <span className="text-sm truncate">{claimedByName ?? 'Claimed'}</span>;
  }

  // Unclaimed — show claim button
  return (
    <button
      type="button"
      onClick={handleClaim}
      disabled={claimMutation.isPending}
      className="text-xs text-primary hover:underline font-medium"
    >
      {claimMutation.isPending ? 'Claiming...' : 'Claim'}
    </button>
  );
}
