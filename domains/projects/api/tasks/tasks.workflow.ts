import { defineWorkflow } from '@packages/workflows';

/**
 * Workflow for tasks.status. Lifted out of `defineEntity` per the camp-B
 * decoupling migration. Registered via `WorkflowsModule.forFeature(TASKS_WORKFLOW)`
 * in `tasks.module.ts`.
 *
 * State names are code-load-bearing: the dashboard rollup query treats
 * `done` as the sole completion state. Renaming requires updating the
 * rollup query.
 */
export const TASKS_WORKFLOW = defineWorkflow({
  slug: 'task-status',
  entityType: 'tasks',
  fieldName: 'status',
  initialState: 'todo',
  states: [
    { name: 'todo', label: 'To Do', color: '#6B7280', isSystem: true },
    { name: 'in_progress', label: 'In Progress', color: '#3B82F6', isSystem: true },
    { name: 'blocked', label: 'Blocked', color: '#EF4444', isSystem: true },
    { name: 'done', label: 'Done', color: '#10B981', isSystem: true },
  ],
  transitions: [
    { from: 'todo', to: ['in_progress', 'done', 'blocked'] },
    { from: 'in_progress', to: ['done', 'blocked', 'todo'] },
    { from: 'blocked', to: ['todo', 'in_progress'] },
    { from: 'done', to: ['todo', 'in_progress'] },
  ],
});
