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
  const isPickedUpByMe = isClaimed && assigneeId === user?.userId;

  const pickupMutation = useMutation({
    mutationFn: () => api.post(tasksRoutes.pickup(taskId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task picked up');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to pick up task');
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

  const handlePickup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    pickupMutation.mutate();
  }, [pickupMutation]);

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

  // Team task, picked up by current user
  if (isTeamTask && isPickedUpByMe) {
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

  // Team task, picked up by someone else
  if (isTeamTask && isClaimed) {
    return (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{assigneeName}</span>
      </div>
    );
  }

  // Team task, not yet picked up
  if (isTeamTask && teamName) {
    return (
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{teamName}</span>
        <button
          type="button"
          onClick={handlePickup}
          disabled={pickupMutation.isPending}
          className="text-xs text-primary hover:underline font-medium shrink-0"
        >
          {pickupMutation.isPending ? '...' : 'Pick up'}
        </button>
      </div>
    );
  }

  // Unassigned
  return <span className="text-sm text-muted-foreground">—</span>;
}
