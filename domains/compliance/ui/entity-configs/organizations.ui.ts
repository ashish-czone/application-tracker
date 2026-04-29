import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const ORGANIZATIONS_UI_CONFIG: EntityUIConfig = {
  entityType: 'organizations',
  presentation: {
    singularName: 'Organization',
    pluralName: 'Organizations',
    icon: 'Building',
    createMode: 'page',
  },
  fieldUI: {
    name: { label: 'Name' },
    legalName: { label: 'Legal Name' },
    logoUrl: { label: 'Logo' },
    email: { label: 'Email' },
    phone: { label: 'Phone' },
    website: { label: 'Website' },
    taxRegistration: { label: 'Tax Registration' },
    fiscalYearStart: { label: 'Fiscal Year Start' },
    addressLine1: { label: 'Address Line 1' },
    addressLine2: { label: 'Address Line 2' },
    city: { label: 'City' },
    state: { label: 'State / Province' },
    postalCode: { label: 'Postal Code' },
    countryId: { label: 'Country' },
  },
  formLayout: {
    sections: [
      { name: 'Organization', fields: ['name', 'legalName', 'logoUrl', 'email', 'phone', 'website', 'taxRegistration', 'fiscalYearStart'] },
      { name: 'Address', fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'countryId'] },
    ],
  },
};
