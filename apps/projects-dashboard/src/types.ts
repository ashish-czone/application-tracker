export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'feature' | 'task' | 'subtask';
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done';

export interface Task {
  id: string;
  type: TaskType;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  completedAt: string | null;
  acceptanceCriteria?: string;
  notes?: string;
}

export interface Project {
  slug: string;
  name: string;
  client: string;
  status: ProjectStatus;
  description: string;
  createdAt: string;
  tasks: Task[];
}

export interface ProjectStats {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  blocked: number;
  pctDone: number;
}

export function computeStats(project: Project): ProjectStats {
  // Leaves = items with no children. A feature with no sub-tasks is itself a
  // unit of work; a feature with children is a container, and its children
  // are the leaves.
  const parentIds = new Set(
    project.tasks.map((t) => t.parentId).filter((p): p is string => p !== null),
  );
  const leaves = project.tasks.filter((t) => !parentIds.has(t.id));
  const total = leaves.length;
  const done = leaves.filter((t) => t.status === 'done').length;
  const inProgress = leaves.filter((t) => t.status === 'in_progress').length;
  const todo = leaves.filter((t) => t.status === 'todo').length;
  const blocked = leaves.filter((t) => t.status === 'blocked').length;
  return {
    total,
    done,
    inProgress,
    todo,
    blocked,
    pctDone: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
