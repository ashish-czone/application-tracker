import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const PAGES_UI_CONFIG: EntityUIConfig = {
  entityType: 'pages',
  presentation: {
    icon: 'FileText',
    navGroup: 'Content',
    createMode: 'modal',
    afterCreateRoute: '/pages/:id/edit',
  },
};
