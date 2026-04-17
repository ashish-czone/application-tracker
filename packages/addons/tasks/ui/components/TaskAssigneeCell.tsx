import { useCallback } from 'react';
import { User, Users } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';
import { usePlatformAPI } from '@packages/platform-ui';
import type { CellRendererProps } from '@packages/ui/components/data-grid/cell-renderers/types';
import { tasksRoutes, type TasksFieldMap } from '@packages/tasks-contract';

const ASSIGNEE_ID: keyof TasksFieldMap = 'assigneeId';
const ASSIGNEE_TEAM_ID: keyof TasksFieldMap = 'assigneeTeamId';
const ASSIGNEE_LABEL = `${ASSIGNEE_ID}__label` as const;
const TEAM_LABEL = `${ASSIGNEE_TEAM_ID}__label` as const;

export function TaskAssigneeCell({ row }: CellRendererProps) {
  const { user } = useAuth();
  const api = usePlatformAPI();
  const queryClient = useQueryClient();

  const taskId = row.id as string;
  const assigneeId = row[ASSIGNEE_ID] as string | null;
  const assigneeName = row[ASSIGNEE_LABEL] as string | undefined;
  const teamName = row[TEAM_LABEL] as string | undefined;
  const isTeamTask = !!row[ASSIGNEE_TEAM_ID];
  const isClaimed = isTeamTask && !!assigneeId;
  const isClaimedByMe = isClaimed && assigneeId === user?.userId;

  const claimMutation = useMutation({
    mutationFn: () => api.post(tasksRoutes.claim(taskId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task claimed');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to claim task');
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: () => api.post(tasksRoutes.unclaim(taskId)),
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

  // Directly assigned to a user (no team)
  if (assigneeName && !isTeamTask) {
    return (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{assigneeName}</span>
      </div>
    );
  }

  // Team task, claimed by current user
  if (isTeamTask && isClaimedByMe) {
    return (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{assigneeName}</span>
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

  // Team task, claimed by someone else
  if (isTeamTask && isClaimed) {
    return (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{assigneeName}</span>
      </div>
    );
  }

  // Team task, unclaimed
  if (isTeamTask && teamName) {
    return (
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{teamName}</span>
        <button
          type="button"
          onClick={handleClaim}
          disabled={claimMutation.isPending}
          className="text-xs text-primary hover:underline font-medium shrink-0"
        >
          {claimMutation.isPending ? '...' : 'Claim'}
        </button>
      </div>
    );
  }

  // Unassigned
  return <span className="text-sm text-muted-foreground">—</span>;
}
