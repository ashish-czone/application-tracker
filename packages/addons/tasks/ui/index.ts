export { TASKS_UI_CONFIG } from './config';
export { TaskAssigneeCell } from './components/TaskAssigneeCell';

// Re-export the typed HTTP contract so UI consumers have one import point.
export { tasksRoutes } from '@packages/tasks-contract';
export type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskTransitionInput,
  TaskStatus,
  TaskPriority,
} from '@packages/tasks-contract';
