import type { EntityConfig } from '@packages/entity-engine';
import { clients } from './schema/clients';

export const CLIENTS_CONFIG: EntityConfig = {
  entityType: 'clients',
  singularName: 'Client',
  pluralName: 'Clients',
  slug: 'clients',

  table: clients,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchColumns: [clients.clientName],

  defaultSort: 'clientName',
  sortableColumns: {
    clientName: clients.clientName,
    industry: clients.industry,
    createdAt: clients.createdAt,
  },

  fieldMeta: {
    clientName: { label: 'Client Name', section: 'basic', sortOrder: 0, isQuickCreate: true, isSystem: true, maxLength: 255 },
    parentClientId: {
      label: 'Parent Client', section: 'basic', sortOrder: 1,
      fieldType: 'lookup', lookupEntity: 'clients', lookupLabelField: 'clientName',
      lookupSearchFields: ['clientName'],
    },
    contactNumber: { label: 'Contact Number', section: 'basic', sortOrder: 2, isQuickCreate: true, fieldType: 'phone' },
    fax: { label: 'Fax', section: 'basic', sortOrder: 3 },
    website: { label: 'Website', section: 'basic', sortOrder: 4, isQuickCreate: true, fieldType: 'url' },
    industry: {
      label: 'Industry', section: 'basic', sortOrder: 5, isQuickCreate: true, fieldType: 'picklist',
      picklistOptions: [
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
      ],
    },
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

  listFields: ['clientName', 'industry', 'contactNumber', 'website', 'contactsCount', 'jobOpeningsCount'],

  sections: [
    { name: 'Client Information', fields: ['clientName', 'parentClientId', 'contactNumber', 'fax', 'website', 'industry', 'about', 'source'] },
    { name: 'Billing Address', fields: ['billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry'] },
    { name: 'Shipping Address', fields: ['shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry'] },
  ],

  lookup: {
    labelField: 'clientName',
    searchFields: ['clientName'],
  },

  relationships: [
    { name: 'contacts', type: 'hasMany', targetEntity: 'contacts', foreignKey: 'clientId', label: 'Contacts', displayFields: ['firstName', 'lastName', 'email', 'jobTitle'] },
    { name: 'jobOpenings', type: 'hasMany', targetEntity: 'job_openings', foreignKey: 'clientId', label: 'Job Openings', displayFields: ['title', 'status', 'createdAt'] },
  ],

  recipientFields: { createdBy: { label: 'Created By' } },

  ui: {
    icon: 'building-2',
    nameField: 'clientName',
    subtitleField: 'industry',
    navGroup: 'recruit',
    navOrder: 4,
  },
};
