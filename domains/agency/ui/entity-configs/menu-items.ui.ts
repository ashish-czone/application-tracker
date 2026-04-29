import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const MENU_ITEMS_UI_CONFIG: EntityUIConfig = {
  entityType: 'menu-items',
  presentation: {
    singularName: 'Menu Item',
    pluralName: 'Menu Items',
    icon: 'List',
  },
  fieldUI: {
    menuId: { label: 'Menu' },
    label: { label: 'Label' },
    linkType: { label: 'Link Type' },
    url: { label: 'URL' },
    pageId: { label: 'Page' },
    target: { label: 'Target' },
    createdBy: { label: 'Created By' },
    createdAt: { label: 'Created At' },
  },
  listColumns: [
    { fieldKey: 'menuId', visible: true, order: 1 },
    { fieldKey: 'label', visible: true, order: 2 },
    { fieldKey: 'linkType', visible: true, order: 3 },
  ],
};
