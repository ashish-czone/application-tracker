import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const SECTIONS_UI_CONFIG: EntityUIConfig = {
  entityType: 'sections',
  presentation: {
    singularName: 'Section',
    pluralName: 'Sections',
    icon: 'LayoutGrid',
  },
  fieldUI: {
    pageId: { label: 'Page' },
    order: { label: 'Order' },
    blockKind: { label: 'Block Kind' },
    variant: { label: 'Variant' },
    title: { label: 'Heading' },
    dataSource: { label: 'Data Source' },
  },
};
