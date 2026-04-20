import { defineEntity } from '@packages/entity-engine';
import { pages } from './schema/pages';

export const PAGES_CONFIG = defineEntity({
  table: pages,
  slug: 'pages',
  singularName: 'Page',
  pluralName: 'Pages',
  onDelete: { mode: 'soft' },
  timestamps: true,

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
    },
    metaDescription: {
      type: 'textarea',
      label: 'Meta Description',
      maxLength: 160,
    },
    ogImage: {
      type: 'url',
      label: 'OG Image URL',
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

  ui: {
    icon: 'FileText',
    navGroup: 'Content',
    createMode: 'modal',
  },
});
