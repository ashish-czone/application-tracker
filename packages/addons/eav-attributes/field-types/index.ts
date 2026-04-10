import { defineFieldType, validators } from '@packages/field-types';
import type { FieldTypePlugin } from '@packages/field-types';

const picklist = defineFieldType({
  type: 'picklist', label: 'Picklist', family: 'selection',
  icon: 'List', color: 'bg-orange-100 text-orange-800', sortOrder: 6,
});

const multiSelect = defineFieldType({
  type: 'multi_select', label: 'Multi-select', family: 'selection',
  icon: 'ListChecks', color: 'bg-orange-100 text-orange-800', sortOrder: 7,
  storage: { type: 'json', column: 'valueText' },
  validate: validators.multiSelect,
  filterOperators: ['contains', 'eq', 'isNull', 'isNotNull'],
  isArray: true,
});

export const eavFieldTypesPlugin: FieldTypePlugin = {
  name: 'eav-attributes',
  fieldTypes: [picklist, multiSelect],
};
