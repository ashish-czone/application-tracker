import { notesFeature } from '@packages/notes';
import { attachmentsFeature } from '@packages/attachments';
import { tagsFeature } from '@packages/taxonomy';

/**
 * Task entity metadata — everything from defineEntity() that is pure data
 * (no Drizzle table, no lifecycle hooks, no SQL-bearing dataAccess scopes).
 * Spread into defineEntity() on the api side.
 */
export const TASKS_METADATA = {
  slug: 'tasks',
  singularName: 'Task',
  pluralName: 'Tasks',
  onDelete: { mode: 'soft' } as const,
  timestamps: true,
  features: {
    ...notesFeature(),
    ...attachmentsFeature(),
    ...tagsFeature({ groupSlug: 'task-tags' }),
  },

  extraPermissions: [
    { action: 'pickup', description: 'Pick up a pending task and move it to in-progress' },
    { action: 'reassign', description: 'Reassign a task to a different user or team' },
    { action: 'review', description: 'Review a task in progress or blocked (peer/maker-checker marker)' },
    { action: 'complete', description: 'Mark tasks as completed' },
    { action: 'reopen', description: 'Reopen completed or cancelled tasks' },
    { action: 'close', description: 'Close (cancel) a non-terminal task' },
  ],

  defaultSort: 'createdAt',

  sections: [
    {
      name: 'Basic Information',
      fields: ['title', 'description', 'status', 'priority', 'assigneeId', 'assigneeTeamId', 'dueDate'],
    },
  ],

  ui: {
    icon: 'CheckSquare',
    navGroup: 'main',
    navOrder: 3,
    createMode: 'modal' as const,
  },
};
