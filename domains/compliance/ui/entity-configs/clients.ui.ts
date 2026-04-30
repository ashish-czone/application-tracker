import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CLIENTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'clients',
  presentation: {
    singularName: 'Client',
    pluralName: 'Clients',
    subtitleField: 'legalName',
    icon: 'Building2',
    navGroup: 'compliance',
    navOrder: 2,
    createMode: 'modal',
  },
  fieldUI: {
    name: { label: 'Name' },
    legalName: { label: 'Legal Name' },
    email: { label: 'Email' },
    phone: { label: 'Phone' },
    websiteDomain: { label: 'Website' },
    taxId: { label: 'Tax ID' },
    industry: { label: 'Industry' },
    complianceAccountManagerId: { label: 'Account Manager' },
    complianceStatus: { label: 'Status' },
    complianceOnboardedAt: { label: 'Onboarded At' },
    addressLine1: { label: 'Address Line 1' },
    addressLine2: { label: 'Address Line 2' },
    city: { label: 'City' },
    state: { label: 'State / Province' },
    postalCode: { label: 'Postal Code' },
    addressCountryId: { label: 'Country' },
    complianceNotes: { label: 'Notes' },
  },
  formLayout: {
    sections: [
      { name: 'Client', fields: ['name', 'legalName', 'email', 'phone', 'websiteDomain', 'taxId', 'industry', 'complianceAccountManagerId', 'complianceStatus', 'complianceOnboardedAt'] },
      { name: 'Address', fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'addressCountryId'] },
      { name: 'Notes', fields: ['complianceNotes'] },
    ],
  },
  listColumns: [
    { fieldKey: 'name', visible: true, order: 1 },
    { fieldKey: 'legalName', visible: true, order: 2 },
    { fieldKey: 'email', visible: true, order: 3 },
    { fieldKey: 'taxId', visible: true, order: 4 },
    { fieldKey: 'industry', visible: true, order: 5 },
    { fieldKey: 'complianceAccountManagerId', visible: true, order: 6 },
    { fieldKey: 'complianceStatus', visible: true, order: 7 },
  ],
};
