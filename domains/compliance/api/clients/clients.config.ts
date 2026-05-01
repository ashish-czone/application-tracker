import { defineEntity } from '@packages/entity-engine';
import { clients } from './clients.schema';

// Address fields are declared individually here rather than through a single
// composite `address` field because the `FieldType` union in entity-engine
// does not yet carry `'address'`, and `DynamicField` does not yet pass
// nested paths to composite form components. When that lands, these six
// entries collapse to one `address: { type: 'address' }` declaration.
export const CLIENTS_CONFIG = defineEntity({
  table: clients,
  slug: 'clients',
  timestamps: true,
  subtitleField: 'legalName',

  // Permissions live in clients.permissions.ts and are registered via
  // RbacIntegrationModule.forFeature in clients.module.ts.
  skipAutoRegistration: { permissions: true },

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
    },
    legalName: {
      type: 'text',
      label: 'Legal Name',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
    email: {
      type: 'email',
      label: 'Email',
      listVisible: true,
      listOrder: 3,
    },
    phone: {
      type: 'phone',
      label: 'Phone',
    },
    websiteDomain: {
      type: 'url',
      label: 'Website',
    },
    taxId: {
      type: 'text',
      label: 'Tax ID',
      unique: true,
      searchable: true,
      listVisible: true,
      listOrder: 4,
    },
    industry: {
      type: 'category',
      label: 'Industry',
      categoryGroupSlug: 'industries',
      listVisible: true,
      listOrder: 5,
    },
    complianceAccountManagerId: {
      type: 'user',
      label: 'Account Manager',
      isRecipient: true,
      listVisible: true,
      listOrder: 6,
    },
    complianceStatus: {
      // Plain text from the engine's perspective; the workflow def lives in
      // clients.workflow.ts and is registered via WorkflowsModule.forFeature.
      type: 'text',
      label: 'Status',
      system: true,
      sortable: true,
      listVisible: true,
      listOrder: 7,
    },
    complianceOnboardedAt: {
      type: 'datetime',
      label: 'Onboarded At',
      sortable: true,
    },
    addressLine1: {
      type: 'text',
      label: 'Address Line 1',
    },
    addressLine2: {
      type: 'text',
      label: 'Address Line 2',
    },
    city: {
      type: 'text',
      label: 'City',
    },
    state: {
      type: 'text',
      label: 'State / Province',
    },
    postalCode: {
      type: 'text',
      label: 'Postal Code',
    },
    addressCountryId: {
      type: 'category',
      label: 'Country',
      categoryGroupSlug: 'countries',
    },
    complianceNotes: {
      type: 'rich_text',
      label: 'Notes',
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Client',
      fields: ['name', 'legalName', 'email', 'phone', 'websiteDomain', 'taxId', 'industry', 'complianceAccountManagerId', 'complianceStatus', 'complianceOnboardedAt'],
    },
    {
      name: 'Address',
      fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'addressCountryId'],
    },
    {
      name: 'Notes',
      fields: ['complianceNotes'],
    },
  ],
});
