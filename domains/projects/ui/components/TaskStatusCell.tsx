import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@packages/ui';
import { Check, ChevronDown, Circle, CircleDot, MinusCircle } from 'lucide-react';
import type { TaskStatus } from '../types';

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  done:        'Done',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo:        '#6B7280',
  in_progress: '#3B82F6',
  blocked:     '#EF4444',
  done:        '#10B981',
};

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  todo:        Circle,
  in_progress: CircleDot,
  blocked:     MinusCircle,
  done:        Check,
};

// Valid transitions mirror the server-side workflow definition
// (domains/projects/api/tasks/tasks.config.ts). Server is the source of
// truth; this list controls only which options the menu shows.
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo:        ['in_progress', 'done', 'blocked'],
  in_progress: ['done', 'blocked', 'todo'],
  blocked:     ['todo', 'in_progress'],
  done:        ['todo', 'in_progress'],
};

interface TaskStatusCellProps {
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
}

export function TaskStatusCell({ status, onChange, disabled }: TaskStatusCellProps) {
  const Icon = STATUS_ICON[status];
  const color = STATUS_COLOR[status];
  const options = TRANSITIONS[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
          aria-label={`Change status from ${STATUS_LABEL[status]}`}
        >
          <Badge
            variant="outline"
            style={{ borderColor: color, color }}
            className="font-medium gap-1.5 cursor-pointer hover:bg-muted/50"
          >
            <Icon className="h-3 w-3" />
            {STATUS_LABEL[status]}
            {!disabled && <ChevronDown className="h-3 w-3 opacity-60" />}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((next) => {
          const NextIcon = STATUS_ICON[next];
          return (
            <DropdownMenuItem key={next} onClick={() => onChange(next)}>
              <NextIcon className="h-3.5 w-3.5 mr-2" style={{ color: STATUS_COLOR[next] }} />
              {STATUS_LABEL[next]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
