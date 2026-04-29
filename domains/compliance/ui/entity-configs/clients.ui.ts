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
    website: { label: 'Website' },
    taxId: { label: 'Tax ID' },
    industryId: { label: 'Industry' },
    accountManagerId: { label: 'Account Manager' },
    status: { label: 'Status' },
    onboardedAt: { label: 'Onboarded At' },
    addressLine1: { label: 'Address Line 1' },
    addressLine2: { label: 'Address Line 2' },
    city: { label: 'City' },
    state: { label: 'State / Province' },
    postalCode: { label: 'Postal Code' },
    countryId: { label: 'Country' },
    notes: { label: 'Notes' },
  },
  formLayout: {
    sections: [
      { name: 'Client', fields: ['name', 'legalName', 'email', 'phone', 'website', 'taxId', 'industryId', 'accountManagerId', 'status', 'onboardedAt'] },
      { name: 'Address', fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'countryId'] },
      { name: 'Notes', fields: ['notes'] },
    ],
  },
  listColumns: [
    { fieldKey: 'name', visible: true, order: 1 },
    { fieldKey: 'legalName', visible: true, order: 2 },
    { fieldKey: 'email', visible: true, order: 3 },
    { fieldKey: 'taxId', visible: true, order: 4 },
    { fieldKey: 'industryId', visible: true, order: 5 },
    { fieldKey: 'accountManagerId', visible: true, order: 6 },
    { fieldKey: 'status', visible: true, order: 7 },
  ],
};
