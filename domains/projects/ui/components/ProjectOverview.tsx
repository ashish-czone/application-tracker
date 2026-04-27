import { Card, CardContent, CardHeader, CardTitle, Progress } from '@packages/ui';
import { Flag, ListChecks, CheckCircle2 } from 'lucide-react';
import type { ProjectSummary } from '../types';

function Stat({ icon: Icon, label, value }: { icon: typeof Flag; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export function ProjectOverview({ project }: { project: ProjectSummary }) {
  const milestonesCompleted = project.milestones.filter((m) => m.status === 'completed').length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          {project.description ? (
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Stat icon={Flag} label="Milestones" value={`${milestonesCompleted}/${project.milestones.length}`} />
          <Stat icon={ListChecks} label="Tasks" value={`${project.doneTaskCount}/${project.taskCount}`} />
          <Stat icon={CheckCircle2} label="Complete" value={`${project.percentComplete}%`} />
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Milestone breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.milestones.length === 0 && (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          )}
          {project.milestones.map((m) => (
            <div key={m.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums ml-2">
                  {m.percentComplete}% · {m.doneTaskCount}/{m.taskCount}
                </span>
              </div>
              <Progress value={m.percentComplete} className="h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
