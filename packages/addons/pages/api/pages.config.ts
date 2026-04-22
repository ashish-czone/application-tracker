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
    metaDescription: {
      type: 'textarea',
      label: 'Meta Description',
      maxLength: 160,
    },
    ogImage: {
      type: 'url',
      label: 'OG Image URL',
    },
    status: {
      type: 'picklist',
      label: 'Status',
      required: true,
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'published', label: 'Published' },
        { value: 'archived', label: 'Archived' },
      ],
      defaultValue: 'draft',
      listVisible: true,
      listOrder: 3,
      sortable: true,
    },
    publishedAt: {
      type: 'datetime',
      label: 'Published At',
      sortable: true,
      listVisible: true,
      listOrder: 4,
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
      listOrder: 5,
    },
  },

  defaultSort: 'createdAt',

  ui: {
    icon: 'FileText',
    navGroup: 'Content',
    createMode: 'modal',
    afterCreateRoute: '/pages/:id/edit',
  },
});
