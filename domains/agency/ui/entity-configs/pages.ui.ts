import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const PAGES_UI_CONFIG: EntityUIConfig = {
  entityType: 'pages',
  presentation: {
    singularName: 'Page',
    pluralName: 'Pages',
    icon: 'FileText',
    navGroup: 'Content',
    createMode: 'modal',
    afterCreateRoute: '/pages/:id/edit',
  },
  fieldUI: {
    title: { label: 'Title' },
    slug: { label: 'Slug' },
    metaDescription: { label: 'Meta Description' },
    ogImage: { label: 'OG Image URL' },
    status: { label: 'Status' },
    publishedAt: { label: 'Published At' },
    createdBy: { label: 'Created By' },
    createdAt: { label: 'Created At' },
  },
  formLayout: {
    quickCreateFields: ['title', 'slug'],
    sections: [],
  },
  listColumns: [
    { fieldKey: 'title', visible: true, order: 1 },
    { fieldKey: 'slug', visible: true, order: 2 },
    { fieldKey: 'status', visible: true, order: 3 },
    { fieldKey: 'publishedAt', visible: true, order: 4 },
    { fieldKey: 'createdAt', visible: true, order: 5 },
  ],
};
