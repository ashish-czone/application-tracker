import type { EntityConfig } from '@packages/entity-engine';
import { clients } from './schema/clients';

export const CLIENTS_CONFIG: EntityConfig = {
  entityType: 'clients',
  slug: 'clients',

  table: clients,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  // Identity fields (clientName/website/industry) are not on this entity's
  // table — they live on directory.companies. ClientsService projects them
  // into list/findOne responses via JOIN, and the FE form declares them as
  // syntheticFields in clients.ui.ts so they still render in the form.
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
  // registers a custom resolver that JOINs directory.companies so labels
  // come from `companies.name` (the canonical identity) instead of the
  // shadow `recruit_clients.client_name` column. F-2c will drop the shadow
  // column entirely.

  relationships: [
    { name: 'contacts', type: 'hasMany', targetEntity: 'contacts', foreignKey: 'clientId', label: 'Contacts', displayFields: ['firstName', 'lastName', 'email', 'jobTitle'] },
    { name: 'jobOpenings', type: 'hasMany', targetEntity: 'job_openings', foreignKey: 'clientId', label: 'Job Openings', displayFields: ['title', 'status', 'createdAt'] },
  ],

  dataAccess: { anchors: { creator: 'createdBy' } },

  recipientFields: { createdBy: { label: 'Created By' } },

  // nameField/subtitleField stay declared as projected aliases — list/findOne
  // surface `clientName` and `industry` from companies via JOIN, and downstream
  // consumers (avatar/name cell renderer, header subtitle) read them by these
  // keys. The columns themselves no longer exist on `recruit_clients`.
  nameField: 'clientName',
  subtitleField: 'industry',
};
