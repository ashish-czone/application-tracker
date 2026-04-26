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
  const leafTasks = project.tasks.filter((t) => t.type !== 'feature');
  const total = leafTasks.length;
  const done = leafTasks.filter((t) => t.status === 'done').length;
  const inProgress = leafTasks.filter((t) => t.status === 'in_progress').length;
  const todo = leafTasks.filter((t) => t.status === 'todo').length;
  const blocked = leafTasks.filter((t) => t.status === 'blocked').length;
  return {
    total,
    done,
    inProgress,
    todo,
    blocked,
    pctDone: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
