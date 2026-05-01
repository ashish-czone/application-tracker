import { defineWorkflow } from '@packages/workflows';

export const MILESTONES_WORKFLOW = defineWorkflow({
  slug: 'milestone-status',
  entityType: 'milestones',
  fieldName: 'status',
  initialState: 'pending',
  states: [
    { name: 'pending', label: 'Pending', color: '#6B7280' },
    { name: 'in_progress', label: 'In Progress', color: '#3B82F6' },
    { name: 'completed', label: 'Completed', color: '#10B981' },
  ],
  transitions: [
    { from: 'pending', to: ['in_progress'] },
    { from: 'in_progress', to: ['completed', 'pending'] },
    { from: 'completed', to: ['in_progress'] },
  ],
});
