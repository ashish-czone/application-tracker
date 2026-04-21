import { defineEntity } from '@packages/entity-engine';
import { stats } from './schema/stats';

export const STATS_CONFIG = defineEntity({
  table: stats,
  slug: 'stats',
  singularName: 'Stat',
  pluralName: 'Stats',
  onDelete: { mode: 'soft' },
  timestamps: true,
  adminConfigurable: true,

  fields: {
    label: {
      type: 'text',
      label: 'Label',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    value: {
      type: 'number',
      label: 'Value',
      required: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    suffix: {
      type: 'text',
      label: 'Suffix',
      listVisible: true,
      listOrder: 3,
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
      listOrder: 4,
    },
  },

  defaultSort: 'displayOrder',

  ui: {
    icon: 'BarChart3',
    navGroup: 'Content',
    navOrder: 70,
    createMode: 'modal',
  },
});
