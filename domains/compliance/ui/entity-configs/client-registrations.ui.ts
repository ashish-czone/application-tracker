import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CLIENT_REGISTRATIONS_UI_CONFIG: EntityUIConfig = {
  entityType: 'client-registrations',
  presentation: {
    singularName: 'Registration',
    pluralName: 'Registrations',
    icon: 'FileBadge',
    createMode: 'modal',
  },
  fieldUI: {
    clientId: { label: 'Client' },
    lawId: { label: 'Law' },
    registrationNumber: { label: 'Registration Number' },
    effectiveFrom: { label: 'Effective From' },
    registeredAt: { label: 'Registered At' },
    deactivatedAt: { label: 'Deactivated At' },
  },
  formLayout: {
    sections: [
      { name: 'Registration', fields: ['clientId', 'lawId', 'registrationNumber', 'effectiveFrom', 'registeredAt', 'deactivatedAt'] },
    ],
  },
  listColumns: [
    { fieldKey: 'clientId', visible: true, order: 1 },
    { fieldKey: 'lawId', visible: true, order: 2 },
    { fieldKey: 'registrationNumber', visible: true, order: 3 },
    { fieldKey: 'effectiveFrom', visible: true, order: 4 },
    { fieldKey: 'registeredAt', visible: true, order: 5 },
    { fieldKey: 'deactivatedAt', visible: true, order: 6 },
  ],
};
