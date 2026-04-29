import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const VENDORS_UI_CONFIG: EntityUIConfig = {
  entityType: 'vendors',
  presentation: {
    singularName: 'Vendor',
    pluralName: 'Vendors',
    subtitleField: 'email',
    icon: 'store',
    navGroup: 'recruit',
    navOrder: 6,
  },
  fieldUI: {
    vendorName: { label: 'Vendor Name', cellRenderer: 'AvatarNameCell' },
    email: { label: 'Email' },
    phone: { label: 'Phone' },
    website: { label: 'Website' },
    emailOptOut: { label: 'Email Opt Out' },
    street: { label: 'Street' },
    city: { label: 'City' },
    province: { label: 'Province' },
    postalCode: { label: 'Postal Code' },
    country: { label: 'Country' },
  },
  formLayout: {
    sections: [
      { name: 'Vendor Information', fields: ['vendorName', 'email', 'phone', 'website', 'emailOptOut'] },
      { name: 'Address Information', fields: ['street', 'city', 'province', 'postalCode', 'country'] },
    ],
    quickCreateFields: ['vendorName', 'email', 'phone'],
  },
  listColumns: [
    { fieldKey: 'vendorName', visible: true, order: 0 },
    { fieldKey: 'email', visible: true, order: 1 },
    { fieldKey: 'phone', visible: true, order: 2 },
    { fieldKey: 'website', visible: true, order: 3 },
  ],
};
