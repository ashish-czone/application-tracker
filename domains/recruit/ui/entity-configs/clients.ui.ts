import type { EntityUIConfig } from '@packages/entity-engine-ui';

const INDUSTRY_OPTIONS = [
  { label: 'Communications', value: 'communications' },
  { label: 'Technology', value: 'technology' },
  { label: 'Government/Military', value: 'government-military' },
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'Financial Services', value: 'financial-services' },
  { label: 'IT Services', value: 'it-services' },
  { label: 'Education', value: 'education' },
  { label: 'Pharma', value: 'pharma' },
  { label: 'Real Estate', value: 'real-estate' },
  { label: 'Consulting', value: 'consulting' },
  { label: 'Health Care', value: 'health-care' },
];

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
    // Identity columns are projected from the directory clients row in
    // ClientsService; the FE renders them by these keys on list/detail rows.
    clientName: { label: 'Client Name', cellRenderer: 'AvatarNameCell' },
    industry: { label: 'Industry' },
    website: { label: 'Website' },
    contactNumber: { label: 'Contact Number' },
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
      { name: 'Client Information', fields: ['clientName', 'website', 'industry', 'contactNumber', 'about', 'source'] },
      { name: 'Billing Address', fields: ['billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry'] },
      { name: 'Shipping Address', fields: ['shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry'] },
    ],
    quickCreateFields: ['clientName', 'website', 'industry', 'contactNumber'],
    // Identity fields don't exist on `recruit_clients` — they live on the
    // directory clients row. The form collects them as synthetic fields and
    // the ClientsService routes them to the directory via findOrCreate / update.
    syntheticFields: [
      {
        section: 'Client Information', fieldKey: 'clientName',
        label: 'Client Name', fieldType: 'text', isRequired: true, maxLength: 255, isQuickCreate: true,
      },
      {
        section: 'Client Information', fieldKey: 'website',
        label: 'Website', fieldType: 'url', isQuickCreate: true,
      },
      {
        section: 'Client Information', fieldKey: 'industry',
        label: 'Industry', fieldType: 'picklist', isQuickCreate: true,
        picklistOptions: INDUSTRY_OPTIONS,
      },
    ],
  },
  listColumns: [
    { fieldKey: 'clientName', visible: true, order: 0 },
    { fieldKey: 'industry', visible: true, order: 1 },
    { fieldKey: 'contactsCount', visible: true, order: 2 },
    { fieldKey: 'jobOpeningsCount', visible: true, order: 3 },
  ],
};
