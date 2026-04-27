import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const COMPLIANCE_FILINGS_UI_CONFIG: EntityUIConfig = {
  entityType: 'compliance-filings',
  presentation: {
    icon: 'ClipboardCheck',
    navGroup: 'compliance',
    navOrder: 4,
  },
  fieldUI: {
    status: { cellRenderer: 'PipelineProgressRenderer' },
  },
};
