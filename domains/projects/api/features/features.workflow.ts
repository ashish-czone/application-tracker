import { defineWorkflow } from '@packages/workflows';

export const FEATURES_WORKFLOW = defineWorkflow({
  slug: 'feature-status',
  entityType: 'features',
  fieldName: 'status',
  initialState: 'backlog',
  states: [
    { name: 'backlog', label: 'Backlog', color: '#6B7280' },
    { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
    { name: 'in_review', label: 'In Review', color: '#F59E0B' },
    { name: 'done', label: 'Done', color: '#10B981' },
  ],
  transitions: [
    { from: 'backlog', to: ['in_progress'] },
    { from: 'in_progress', to: ['in_review', 'backlog'] },
    { from: 'in_review', to: ['done', 'in_progress'] },
    { from: 'done', to: ['in_progress'] },
  ],
});
