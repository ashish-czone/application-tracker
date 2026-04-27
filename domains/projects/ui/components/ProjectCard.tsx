import { Link } from 'react-router';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Progress,
} from '@packages/ui';
import { CalendarDays, ListChecks, Flag, AlertCircle } from 'lucide-react';
import type { ProjectDashboardCard } from '../types';

const STATUS_TONE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planning:  'outline',
  active:    'default',
  on_hold:   'secondary',
  completed: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  planning:  'Planning',
  active:    'Active',
  on_hold:   'On Hold',
  completed: 'Completed',
};

interface ProjectCardProps {
  project: ProjectDashboardCard;
  to: string;
}

export function ProjectCard({ project, to }: ProjectCardProps) {
  const stripe = project.color ?? '#3B82F6';
  const isOverdue = project.overdueTaskCount > 0;

  return (
    <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
      <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
        <div className="h-1.5" style={{ backgroundColor: stripe }} aria-hidden />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold truncate">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {project.description}
                </p>
              )}
            </div>
            <Badge variant={STATUS_TONE[project.status] ?? 'secondary'}>
              {STATUS_LABEL[project.status] ?? project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{project.percentComplete}% complete</span>
              <span>{project.doneTaskCount} / {project.taskCount} tasks</span>
            </div>
            <Progress value={project.percentComplete} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Flag className="h-3.5 w-3.5" />
              {project.milestoneCount} milestones
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {project.taskCount} tasks
            </span>
            {project.targetDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {project.targetDate}
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {project.overdueTaskCount} overdue
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
