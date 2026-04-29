import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const CLIENTS_UI_CONFIG: EntityUIConfig = {
  entityType: 'clients',
  presentation: {
    singularName: 'Client',
    pluralName: 'Clients',
    subtitleField: 'industry',
    icon: 'building-2',
    navGroup: 'recruit',
    navOrder: 4,
  },
  fieldUI: {
    clientName: { label: 'Client Name', cellRenderer: 'AvatarNameCell' },
    contactNumber: { label: 'Contact Number' },
    website: { label: 'Website' },
    industry: { label: 'Industry' },
    about: { label: 'About' },
    source: { label: 'Source' },
    billingStreet: { label: 'Billing Street' },
    billingCity: { label: 'Billing City' },
    billingProvince: { label: 'Billing Province' },
    billingCode: { label: 'Billing Code' },
    billingCountry: { label: 'Billing Country' },
    shippingStreet: { label: 'Shipping Street' },
    shippingCity: { label: 'Shipping City' },
    shippingProvince: { label: 'Shipping Province' },
    shippingCode: { label: 'Shipping Code' },
    shippingCountry: { label: 'Shipping Country' },
  },
  formLayout: {
    sections: [
      { name: 'Client Information', fields: ['clientName', 'contactNumber', 'website', 'industry', 'about', 'source'] },
      { name: 'Billing Address', fields: ['billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry'] },
      { name: 'Shipping Address', fields: ['shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry'] },
    ],
    quickCreateFields: ['clientName', 'contactNumber', 'website', 'industry'],
  },
  listColumns: [
    { fieldKey: 'clientName', visible: true, order: 0 },
    { fieldKey: 'industry', visible: true, order: 1 },
    { fieldKey: 'contactsCount', visible: true, order: 2 },
    { fieldKey: 'jobOpeningsCount', visible: true, order: 3 },
  ],
};
