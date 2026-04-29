import type { EntityConfig } from '@packages/entity-engine';
import { vendors } from './schema/vendors';

export const VENDORS_CONFIG: EntityConfig = {
  entityType: 'vendors',
  slug: 'vendors',

  table: vendors,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchFields: ['vendorName', 'email'],

  defaultSort: 'vendorName',
  sortableFields: ['vendorName', 'email', 'createdAt'],

  fieldMeta: {
    vendorName: { label: 'Vendor Name', section: 'basic', sortOrder: 0, isQuickCreate: true, isSystem: true, maxLength: 120, cellRenderer: 'AvatarNameCell' },
    email: { label: 'Email', section: 'basic', sortOrder: 1, isQuickCreate: true, fieldType: 'email', maxLength: 120 },
    phone: { label: 'Phone', section: 'basic', sortOrder: 2, isQuickCreate: true, fieldType: 'phone' },
    website: { label: 'Website', section: 'basic', sortOrder: 3, fieldType: 'url' },
    emailOptOut: { label: 'Email Opt Out', section: 'basic', sortOrder: 4, fieldType: 'boolean' },
    // Address
    street: { label: 'Street', section: 'address', sortOrder: 0 },
    city: { label: 'City', section: 'address', sortOrder: 1, maxLength: 30 },
    province: { label: 'Province', section: 'address', sortOrder: 2, maxLength: 30 },
    postalCode: { label: 'Postal Code', section: 'address', sortOrder: 3, maxLength: 30 },
    country: { label: 'Country', section: 'address', sortOrder: 4, fieldType: 'category', categoryGroupSlug: 'countries' },
  },

  listFields: ['vendorName', 'email', 'phone', 'website'],

  sections: [
    { name: 'Vendor Information', fields: ['vendorName', 'email', 'phone', 'website', 'emailOptOut'] },
    { name: 'Address Information', fields: ['street', 'city', 'province', 'postalCode', 'country'] },
  ],

  lookup: {
    labelField: 'vendorName',
    searchFields: ['vendorName', 'email'],
  },

  dataAccess: { anchors: { creator: 'createdBy' } },

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  nameField: 'vendorName',
  subtitleField: 'email',
};
