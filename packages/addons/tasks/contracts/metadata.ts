/**
 * Task entity metadata — everything from defineEntity() that is pure data
 * (no Drizzle table, no lifecycle hooks, no SQL-bearing dataAccess scopes).
 * Spread into defineEntity() on the api side.
 */
export const TASKS_METADATA = {
  slug: 'tasks',
  singularName: 'Task',
  pluralName: 'Tasks',
  softDelete: true,
  timestamps: true,
  hasNotes: true,
  hasAttachments: true,
  hasTags: { groupSlug: 'task-tags' },

  extraPermissions: [
    { action: 'assign', description: 'Assign tasks to users or teams' },
    { action: 'submitForReview', description: 'Submit a task for review' },
    { action: 'approveReview', description: 'Approve a task in review and mark it completed' },
    { action: 'complete', description: 'Mark tasks as completed' },
    { action: 'cancel', description: 'Cancel tasks' },
    { action: 'reopen', description: 'Reopen completed or cancelled tasks' },
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
