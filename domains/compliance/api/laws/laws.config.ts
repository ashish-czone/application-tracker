import { defineEntity } from '@packages/entity-engine';
import { complianceLaws } from '../schema/laws';

export const LAWS_CONFIG = defineEntity({
  table: complianceLaws,
  slug: 'laws',
  timestamps: true,
  hierarchy: true,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
    },
    code: {
      type: 'text',
      label: 'Code',
      required: true,
      unique: true,
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
    },
    issuingAuthority: {
      type: 'text',
      label: 'Issuing Authority',
      listVisible: true,
      listOrder: 3,
    },
    jurisdiction: {
      type: 'picklist',
      label: 'Jurisdiction',
      options: [
        { label: 'Central', value: 'central' },
        { label: 'State', value: 'state' },
        { label: 'Municipal', value: 'municipal' },
        { label: 'International', value: 'international' },
      ],
      listVisible: true,
      listOrder: 4,
    },
    effectiveFrom: {
      type: 'date',
      label: 'Effective From',
    },
    description: {
      type: 'textarea',
      label: 'Description',
      maxLength: 32000,
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Law',
      fields: ['name', 'code', 'issuingAuthority', 'jurisdiction', 'effectiveFrom', 'description'],
    },
  ],
});
