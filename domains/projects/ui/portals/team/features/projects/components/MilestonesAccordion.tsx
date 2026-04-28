import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Input,
  Progress,
} from '@packages/ui';
import { CalendarDays, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCreateMilestone, useDeleteMilestone } from '../../../../../hooks/useMilestonesApi';
import { useCreateFeature, useDeleteFeature } from '../../../../../hooks/useFeaturesApi';
import { useCreateTask, useDeleteTask, useTransitionTask } from '../../../../../hooks/useTasksApi';
import { TaskStatusCell } from '../../../../../components/TaskStatusCell';
import type {
  ProjectSummary,
  ProjectSummaryFeature,
  ProjectSummaryMilestone,
  ProjectSummaryTask,
  TaskStatus,
} from '../../../../../types';

const FEATURE_STATUS_LABEL: Record<string, string> = {
  backlog:     'Backlog',
  in_progress: 'In Progress',
  in_review:   'In Review',
  done:        'Done',
};

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
};

interface QuickAddRowProps {
  placeholder: string;
  onAdd: (name: string) => void;
  pending?: boolean;
}

function QuickAddRow({ placeholder, onAdd, pending }: QuickAddRowProps) {
  const [value, setValue] = useState('');
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        onBlur={submit}
        className="h-8 border-0 shadow-none focus-visible:ring-1 px-1.5"
        disabled={pending}
      />
    </div>
  );
}

interface TaskRowProps {
  task: ProjectSummaryTask;
  featureId: string;
  projectId: string;
}

function TaskRow({ task, featureId, projectId }: TaskRowProps) {
  const transition = useTransitionTask(featureId, projectId);
  const del = useDeleteTask(featureId, projectId);

  return (
    <div className="flex items-center gap-2 py-1 group">
      <span className="flex-1 min-w-0 text-sm truncate">{task.title}</span>
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
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={() => del.mutate(task.id)}
        title="Delete task"
        aria-label={`Delete task ${task.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface FeatureBlockProps {
  feature: ProjectSummaryFeature;
  milestoneId: string;
  projectId: string;
}

function FeatureBlock({ feature, milestoneId, projectId }: FeatureBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const createTask = useCreateTask(feature.id, projectId);
  const deleteFeature = useDeleteFeature(milestoneId, projectId);

  return (
    <div className="rounded border bg-card">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          aria-hidden
        />
        <span className="font-medium text-sm flex-1 truncate">{feature.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {FEATURE_STATUS_LABEL[feature.status] ?? feature.status}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {feature.doneTaskCount}/{feature.taskCount}
        </span>
        <div className="w-24">
          <Progress value={feature.percentComplete} className="h-1.5" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            deleteFeature.mutate(feature.id);
          }}
          title="Delete feature"
          aria-label={`Delete feature ${feature.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </button>
      {expanded && (
        <div className="border-t px-3 py-1.5 space-y-0.5">
          {feature.tasks.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No tasks yet.</p>
          )}
          {feature.tasks.map((task) => (
            <TaskRow key={task.id} task={task} featureId={feature.id} projectId={projectId} />
          ))}
          <QuickAddRow
            placeholder="Add task…"
            onAdd={(title) => createTask.mutate({ title })}
            pending={createTask.isPending}
          />
        </div>
      )}
    </div>
  );
}

interface MilestoneBlockProps {
  milestone: ProjectSummaryMilestone;
  projectId: string;
}

function MilestoneBlock({ milestone, projectId }: MilestoneBlockProps) {
  const createFeature = useCreateFeature(milestone.id, projectId);
  const deleteMilestone = useDeleteMilestone(projectId);

  return (
    <AccordionItem value={milestone.id} className="border rounded-md mb-2">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-medium truncate">{milestone.name}</span>
          <Badge variant="outline">
            {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
          </Badge>
          {milestone.dueDate && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {milestone.dueDate}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {milestone.doneTaskCount}/{milestone.taskCount}
            </span>
            <div className="w-32">
              <Progress value={milestone.percentComplete} className="h-1.5" />
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2">
          {milestone.features.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No features yet.</p>
          )}
          {milestone.features.map((feature) => (
            <FeatureBlock
              key={feature.id}
              feature={feature}
              milestoneId={milestone.id}
              projectId={projectId}
            />
          ))}
          <div className="pt-1">
            <QuickAddRow
              placeholder="Add feature…"
              onAdd={(name) => createFeature.mutate({ name })}
              pending={createFeature.isPending}
            />
          </div>
          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMilestone.mutate(milestone.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete milestone
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function MilestonesAccordion({ project }: { project: ProjectSummary }) {
  const createMilestone = useCreateMilestone(project.id);
  const defaultOpen = project.milestones.length > 0 ? [project.milestones[0].id] : [];

  return (
    <div className="space-y-3">
      <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
        {project.milestones.map((m) => (
          <MilestoneBlock key={m.id} milestone={m} projectId={project.id} />
        ))}
      </Accordion>

      {project.milestones.length === 0 && (
        <div className="border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground">
          No milestones yet. Add the first one below.
        </div>
      )}

      <div className="border rounded-md p-2 bg-muted/20">
        <QuickAddRow
          placeholder="Add milestone…"
          onAdd={(name) => createMilestone.mutate({ name })}
          pending={createMilestone.isPending}
        />
      </div>
    </div>
  );
}
