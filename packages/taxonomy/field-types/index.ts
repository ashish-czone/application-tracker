import { defineFieldType, validators } from '@packages/field-types';
import type { FieldTypePlugin } from '@packages/field-types';

const tags = defineFieldType({
  type: 'tags', label: 'Tags', family: 'taxonomy',
  icon: 'Tag', color: 'bg-teal-100 text-teal-800', sortOrder: 18,
});

const category = defineFieldType({
  type: 'category', label: 'Category', family: 'taxonomy',
  icon: 'FolderTree', color: 'bg-yellow-100 text-yellow-800', sortOrder: 19,
  // Category stores a single UUID in EAV (like a lookup), not a junction table
  storage: { type: 'eav', column: 'valueText' },
  validate: validators.uuid,
  filterOperators: ['eq', 'in', 'isNull', 'isNotNull'],
  isArray: false,
  isReference: true,
});

export const taxonomyFieldTypesPlugin: FieldTypePlugin = {
  name: 'taxonomy',
  fieldTypes: [tags, category],
};
