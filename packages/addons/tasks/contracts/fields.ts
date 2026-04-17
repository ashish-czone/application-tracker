import type { FieldMap } from '@packages/entity-engine-contract';

/**
 * Task field map — pure declarative data shared between api and ui.
 * Imported by @packages/tasks to compose the full defineEntity() config
 * (which layers on the Drizzle table, lifecycle hooks and dataAccess
 * scopes), and by @packages/tasks-ui to derive typed row/input shapes.
 */
export const TASKS_FIELDS = {
  title: {
    type: 'text',
    label: 'Title',
    required: true,
    searchable: true,
    sortable: true,
    isLabel: true,
    quickCreate: true,
    listVisible: true,
    listOrder: 1,
  },
  description: {
    type: 'textarea',
    label: 'Description',
    quickCreate: true,
  },
  status: {
    type: 'workflow',
    label: 'Status',
    system: true,
    sortable: true,
    listVisible: true,
    listOrder: 2,
    cellRenderer: 'PipelineProgressRenderer',
    workflow: {
      slug: 'task-status',
      initialState: 'pending',
      states: [
        { name: 'pending', label: 'Pending', color: '#6B7280' },
        { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
        { name: 'review', label: 'In Review', color: '#F59E0B' },
        { name: 'completed', label: 'Completed', color: '#10B981' },
        { name: 'cancelled', label: 'Cancelled', color: '#EF4444' },
      ],
      transitions: [
        { from: 'pending', to: [
          'in_progress',
          { state: 'cancelled', requiredPermissions: ['tasks.cancel'] },
        ]},
        { from: 'in_progress', to: [
          { state: 'review', requiredPermissions: ['tasks.submitForReview'] },
          { state: 'completed', requiredPermissions: ['tasks.complete'] },
          { state: 'cancelled', requiredPermissions: ['tasks.cancel'] },
        ]},
        { from: 'review', to: [
          { state: 'completed', requiredPermissions: ['tasks.approveReview'] },
          { state: 'in_progress', requiredPermissions: ['tasks.reopen'] },
          { state: 'cancelled', requiredPermissions: ['tasks.cancel'] },
        ]},
        { from: 'completed', to: [
          { state: 'pending', requiredPermissions: ['tasks.reopen'] },
        ]},
        { from: 'cancelled', to: [
          { state: 'pending', requiredPermissions: ['tasks.reopen'] },
        ]},
      ],
    },
  },
  priority: {
    type: 'picklist',
    label: 'Priority',
    sortable: true,
    quickCreate: true,
    listVisible: true,
    listOrder: 3,
    defaultValue: 'medium',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium', isDefault: true },
      { label: 'High', value: 'high' },
      { label: 'Urgent', value: 'urgent' },
    ],
  },
  assigneeId: {
    type: 'user',
    label: 'Assignee',
    quickCreate: true,
    listVisible: true,
    listOrder: 4,
    isRecipient: true,
    cellRenderer: 'TaskAssigneeCell',
  },
  assigneeTeamId: {
    type: 'lookup',
    label: 'Assigned Team',
    entity: 'org-units',
    lookupLabelField: 'name',
    lookupSearchFields: ['name'],
    quickCreate: true,
    listColumnHidden: true,
  },
  dueDate: {
    type: 'date',
    label: 'Due Date',
    sortable: true,
    quickCreate: true,
    listVisible: true,
    listOrder: 5,
  },
  createdBy: {
    type: 'user',
    label: 'Creator',
    system: true,
    readonly: true,
    isRecipient: true,
  },
  relatedEntityType: {
    type: 'text',
    label: 'Related Entity Type',
    system: true,
    readonly: true,
    excludeFromList: true,
  },
  relatedEntityId: {
    type: 'text',
    label: 'Related Entity ID',
    system: true,
    readonly: true,
    excludeFromList: true,
  },
  externalKey: {
    type: 'text',
    label: 'External Key',
    system: true,
    readonly: true,
    excludeFromList: true,
  },
} satisfies FieldMap;

export type TasksFieldMap = typeof TASKS_FIELDS;
