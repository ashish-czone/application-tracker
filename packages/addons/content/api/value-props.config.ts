import { defineEntity } from '@packages/entity-engine';
import { valueProps } from './schema/value-props';

export const VALUE_PROPS_CONFIG = defineEntity({
  table: valueProps,
  slug: 'value-props',
  singularName: 'Value Proposition',
  pluralName: 'Value Propositions',
  onDelete: { mode: 'soft' },
  timestamps: true,
  adminConfigurable: true,

  fields: {
    title: {
      type: 'text',
      label: 'Title',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    description: {
      type: 'textarea',
      label: 'Description',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    iconName: {
      type: 'text',
      label: 'Icon Name',
    },
    displayOrder: {
      type: 'number',
      label: 'Display Order',
      sortable: true,
    },
    isActive: {
      type: 'boolean',
      label: 'Active',
      listVisible: true,
      listOrder: 3,
    },
  },

  defaultSort: 'displayOrder',

  ui: {
    icon: 'Sparkles',
    navGroup: 'Content',
    navOrder: 60,
    createMode: 'modal',
  },
});
