import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const COMPLIANCE_RULES_UI_CONFIG: EntityUIConfig = {
  entityType: 'compliance-rules',
  presentation: {
    icon: 'Calendar',
    navGroup: 'compliance',
    navOrder: 3,
    createMode: 'modal',
  },
};
