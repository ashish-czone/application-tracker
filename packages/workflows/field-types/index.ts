import { defineFieldType } from '@packages/field-types';
import type { FieldTypePlugin } from '@packages/field-types';

const workflow = defineFieldType({
  type: 'workflow', label: 'Workflow', family: 'special',
  icon: 'GitBranch', color: 'bg-blue-100 text-blue-800', sortOrder: 22,
  filterOperators: ['eq', 'neq', 'in'],
  filterable: true,
  excludeFromList: false,
  sortable: true,
});

export const workflowFieldTypesPlugin: FieldTypePlugin = {
  name: 'workflows',
  fieldTypes: [workflow],
};
