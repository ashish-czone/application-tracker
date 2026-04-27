import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const PROJECTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'projects',
  presentation: {
    icon: 'FolderKanban',
    navGroup: 'Projects',
    navOrder: 1,
    createMode: 'modal',
  },
};
