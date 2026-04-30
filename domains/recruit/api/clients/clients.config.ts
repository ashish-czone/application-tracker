import type { EntityConfig } from '@packages/entity-engine';
import { clients } from './clients-ref';

export const CLIENTS_CONFIG: EntityConfig = {
  entityType: 'clients',
  slug: 'clients',

  // The recruit "client" IS a directory `clients` row with
  // recruit_became_client_at set. ClientsService owns the actual CRUD —
  // entity-engine only uses this config for metadata (lookup resolver
  // registration, fieldMeta for form rendering, layouts).
  table: clients,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  // Identity fields (clientName/website/industry) are projected from base
  // directory columns; commercial fields read from recruit_*. The FE form
  // declares the projected aliases as syntheticFields in clients.ui.ts.
  searchFields: [],

  defaultSort: 'createdAt',
  sortableFields: ['createdAt'],

  fieldMeta: {
    contactNumber: { label: 'Contact Number', section: 'basic', sortOrder: 2, isQuickCreate: true, fieldType: 'phone' },
    about: { label: 'About', section: 'basic', sortOrder: 6, fieldType: 'textarea', maxLength: 32000 },
    source: {
      label: 'Source', section: 'basic', sortOrder: 7, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Added by User', value: 'added-by-user' },
        { label: 'API', value: 'api' },
        { label: 'Import', value: 'import' },
        { label: 'Internal', value: 'internal' },
      ],
    },
    // Billing Address
    billingStreet: { label: 'Billing Street', section: 'billing-address', sortOrder: 0 },
    billingCity: { label: 'Billing City', section: 'billing-address', sortOrder: 1 },
    billingProvince: { label: 'Billing Province', section: 'billing-address', sortOrder: 2 },
    billingCode: { label: 'Billing Code', section: 'billing-address', sortOrder: 3 },
    billingCountry: { label: 'Billing Country', section: 'billing-address', sortOrder: 4, fieldType: 'category', categoryGroupSlug: 'countries' },
    // Shipping Address
    shippingStreet: { label: 'Shipping Street', section: 'shipping-address', sortOrder: 0 },
    shippingCity: { label: 'Shipping City', section: 'shipping-address', sortOrder: 1 },
    shippingProvince: { label: 'Shipping Province', section: 'shipping-address', sortOrder: 2 },
    shippingCode: { label: 'Shipping Code', section: 'shipping-address', sortOrder: 3 },
    shippingCountry: { label: 'Shipping Country', section: 'shipping-address', sortOrder: 4, fieldType: 'category', categoryGroupSlug: 'countries' },
  },

  listFields: ['contactsCount', 'jobOpeningsCount'],

  sections: [
    { name: 'Client Information', fields: ['contactNumber', 'about', 'source'] },
    { name: 'Billing Address', fields: ['billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry'] },
    { name: 'Shipping Address', fields: ['shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry'] },
  ],

  // Lookup resolution is owned by ClientsService.onModuleInit() — it
  // registers a custom resolver that reads directly from `clients`, so
  // labels are clients.name and values are clients.id. The picker's resolve
  // step calls /clients/find-or-create-for-client to stamp recruit_became_client_at.

  relationships: [
    { name: 'contacts', type: 'hasMany', targetEntity: 'contacts', foreignKey: 'clientId', label: 'Contacts', displayFields: ['firstName', 'lastName', 'email', 'jobTitle'] },
    { name: 'jobOpenings', type: 'hasMany', targetEntity: 'job_openings', foreignKey: 'clientId', label: 'Job Openings', displayFields: ['title', 'status', 'createdAt'] },
  ],

  dataAccess: { anchors: { creator: 'createdBy' } },

  recipientFields: { createdBy: { label: 'Created By' } },

  // The row id IS clients.id; service projects clientName/industry from
  // base directory columns into the response.
  nameField: 'clientName',
  subtitleField: 'industry',
};
