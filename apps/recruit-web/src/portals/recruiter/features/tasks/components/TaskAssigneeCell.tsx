import { User, Users } from 'lucide-react';
import type { CellRendererProps } from '@packages/ui/components/data-grid/cell-renderers/types';

export function TaskAssigneeCell({ row }: CellRendererProps) {
  const assigneeName = row.assigneeId__label as string | undefined;
  const teamName = row.assigneeTeamId__label as string | undefined;

  if (assigneeName) {
    return (
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{assigneeName}</span>
      </div>
    );
  }

  if (teamName) {
    return (
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{teamName}</span>
      </div>
    );
  }

  return <span className="text-sm text-muted-foreground">—</span>;
}
