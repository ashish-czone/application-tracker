import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const MENUS_UI_CONFIG: EntityUIConfig = {
  entityType: 'menus',
  presentation: {
    singularName: 'Menu',
    pluralName: 'Menus',
    icon: 'Menu',
    navGroup: 'Content',
    createMode: 'modal',
    afterCreateRoute: '/menus/:id/edit',
  },
  fieldUI: {
    name: { label: 'Name' },
    slug: { label: 'Slug' },
    description: { label: 'Description' },
    createdBy: { label: 'Created By' },
    createdAt: { label: 'Created At' },
  },
  formLayout: {
    quickCreateFields: ['name', 'slug'],
    sections: [],
  },
  listColumns: [
    { fieldKey: 'name', visible: true, order: 1 },
    { fieldKey: 'slug', visible: true, order: 2 },
    { fieldKey: 'createdAt', visible: true, order: 3 },
  ],
};
