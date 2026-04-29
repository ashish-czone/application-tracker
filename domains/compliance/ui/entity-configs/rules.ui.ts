import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const COMPLIANCE_RULES_UI_CONFIG: EntityUIConfig = {
  entityType: 'compliance-rules',
  presentation: {
    singularName: 'Compliance Rule',
    pluralName: 'Compliance Rules',
    icon: 'Calendar',
    navGroup: 'compliance',
    navOrder: 3,
    createMode: 'modal',
  },
  fieldUI: {
    code: { label: 'Code' },
    name: { label: 'Name' },
    lawId: { label: 'Law' },
    frequency: { label: 'Frequency' },
    status: { label: 'Status' },
    dueDayOfMonth: { label: 'Due Day of Month' },
    dueMonthOffset: { label: 'Due Month Offset' },
    gracePeriodDays: { label: 'Grace Period (days)' },
    description: { label: 'Description' },
  },
  formLayout: {
    sections: [
      { name: 'Rule', fields: ['code', 'name', 'lawId', 'frequency', 'status', 'dueDayOfMonth', 'dueMonthOffset', 'gracePeriodDays', 'description'] },
    ],
  },
  listColumns: [
    { fieldKey: 'code', visible: true, order: 1 },
    { fieldKey: 'name', visible: true, order: 2 },
    { fieldKey: 'lawId', visible: true, order: 3 },
    { fieldKey: 'frequency', visible: true, order: 4 },
    { fieldKey: 'status', visible: true, order: 5 },
  ],
};
