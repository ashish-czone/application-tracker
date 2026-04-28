import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@packages/ui';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useMyTasks, useTransitionTaskFromMyList } from '../../../../api/hooks';
import { TaskStatusCell } from '../../../../components/TaskStatusCell';
import type { MyTaskRow, TaskStatus } from '../../../../types';

interface ProjectGroup {
  projectId: string;
  projectName: string;
  projectColor: string | null;
  tasks: MyTaskRow[];
}

function groupByProject(rows: MyTaskRow[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const row of rows) {
    const existing = map.get(row.projectId);
    if (existing) {
      existing.tasks.push(row);
    } else {
      map.set(row.projectId, {
        projectId: row.projectId,
        projectName: row.projectName,
        projectColor: row.projectColor,
        tasks: [row],
      });
    }
  }
  return Array.from(map.values());
}

function TaskRow({ task }: { task: MyTaskRow }) {
  const transition = useTransitionTaskFromMyList();
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
      <span className="flex-1 min-w-0">
        <span className="text-sm truncate block">{task.title}</span>
        <span className="text-xs text-muted-foreground">
          {task.featureName} · {task.milestoneName}
        </span>
      </span>
      {task.dueDate && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {task.dueDate}
        </span>
      )}
      <TaskStatusCell
        status={task.status}
        onChange={(next: TaskStatus) =>
          transition.mutate({ id: task.id, to: next })
        }
        disabled={transition.isPending}
      />
    </div>
  );
}

function ProjectGroupCard({ group }: { group: ProjectGroup }) {
  const stripe = group.projectColor ?? '#3B82F6';
  const open = group.tasks.filter((t) => t.status !== 'done').length;

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ backgroundColor: stripe }} aria-hidden />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{group.projectName}</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/projects/${group.projectId}`}>
              Open
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {open} of {group.tasks.length} open
        </p>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {group.tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MyTasksPage() {
  const { data, isLoading, isError, refetch } = useMyTasks();

  const groups = useMemo(() => (data ? groupByProject(data) : []), [data]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tasks assigned to you across every project.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          quote="We couldn't load your tasks."
          cta={<Button onClick={() => refetch()}>Retry</Button>}
        />
      )}

      {data && groups.length === 0 && (
        <EmptyState quote="Nothing on your plate. Pick something to start." />
      )}

      {groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <ProjectGroupCard key={group.projectId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
