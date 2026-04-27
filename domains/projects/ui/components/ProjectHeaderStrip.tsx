import { Badge, Progress } from '@packages/ui';
import { CalendarDays } from 'lucide-react';
import type { ProjectSummary } from '../types';

const STATUS_LABEL: Record<string, string> = {
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  completed: 'Completed',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  planning:  'outline',
  active:    'default',
  on_hold:   'secondary',
  completed: 'default',
};

export function ProjectHeaderStrip({ project }: { project: ProjectSummary }) {
  const stripe = project.color ?? '#3B82F6';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded" style={{ backgroundColor: stripe }} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold truncate">{project.name}</h1>
            <Badge variant={STATUS_VARIANT[project.status] ?? 'secondary'}>
              {STATUS_LABEL[project.status] ?? project.status}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between gap-2 mb-1">
          <span className="text-sm font-medium">{project.percentComplete}% complete</span>
          <span className="text-xs text-muted-foreground">
            {project.doneTaskCount} / {project.taskCount} tasks done
          </span>
        </div>
        <Progress value={project.percentComplete} className="h-2.5" />
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {project.startDate && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Start: {project.startDate}
          </span>
        )}
        {project.targetDate && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Target: {project.targetDate}
          </span>
        )}
      </div>
    </div>
  );
}
