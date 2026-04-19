import { defineFieldType, validators } from '@packages/field-types';
import type { FieldTypePlugin } from '@packages/field-types';

export const addressFieldType = defineFieldType({
  type: 'address',
  label: 'Address',
  family: 'special',
  icon: 'MapPin',
  color: 'bg-teal-100 text-teal-800',
  sortOrder: 22,
  storage: { type: 'composite' },
  validate: validators.noop,
  filterOperators: ['isNull', 'isNotNull'],
  filterable: true,
  excludeFromList: false,
  sortable: false,
  creatable: true,
});

export const addressFieldTypePlugin: FieldTypePlugin = {
  name: 'address',
  fieldTypes: [addressFieldType],
};

export { addressZodSchema } from './zod';
