import { defineEntity } from '@packages/entity-engine';
import { menus } from './schema/menus';

export const MENU_CONFIG = defineEntity({
  table: menus,
  slug: 'menus',
  timestamps: true,
  adminConfigurable: true,

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
      quickCreate: true,
    },
    slug: {
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    description: {
      type: 'textarea',
      label: 'Description',
      maxLength: 280,
    },
    createdBy: {
      type: 'user',
      label: 'Created By',
      system: true,
      readonly: true,
    },
    createdAt: {
      type: 'datetime',
      label: 'Created At',
      system: true,
      readonly: true,
      sortable: true,
      listVisible: true,
      listOrder: 3,
    },
  },

  defaultSort: 'createdAt',
});
