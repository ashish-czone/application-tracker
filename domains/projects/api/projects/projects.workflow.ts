import { defineWorkflow } from '@packages/workflows';

export const PROJECTS_WORKFLOW = defineWorkflow({
  slug: 'project-status',
  entityType: 'projects',
  fieldName: 'status',
  initialState: 'planning',
  states: [
    { name: 'planning', label: 'Planning', color: '#6B7280' },
    { name: 'active', label: 'Active', color: '#10B981' },
    { name: 'on_hold', label: 'On Hold', color: '#F59E0B' },
    { name: 'completed', label: 'Completed', color: '#3B82F6' },
  ],
  transitions: [
    { from: 'planning', to: ['active'] },
    { from: 'active', to: ['on_hold', 'completed'] },
    { from: 'on_hold', to: ['active'] },
    { from: 'completed', to: ['active'] },
  ],
});
