import { defineEntity } from '@packages/entity-engine';
import { clients } from '../schema/clients';

// Address fields are declared individually here rather than through a single
// composite `address` field because the `FieldType` union in entity-engine
// does not yet carry `'address'`, and `DynamicField` does not yet pass
// nested paths to composite form components. When that lands, these six
// entries collapse to one `address: { type: 'address' }` declaration.
export const CLIENTS_CONFIG = defineEntity({
  table: clients,
  slug: 'clients',
  singularName: 'Client',
  pluralName: 'Clients',
  onDelete: { mode: 'hard' },
  timestamps: true,

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
    website: {
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
    industryId: {
      type: 'category',
      label: 'Industry',
      categoryGroupSlug: 'industries',
      listVisible: true,
      listOrder: 5,
    },
    accountManagerId: {
      type: 'user',
      label: 'Account Manager',
      isRecipient: true,
      listVisible: true,
      listOrder: 6,
    },
    status: {
      type: 'workflow',
      label: 'Status',
      system: true,
      sortable: true,
      listVisible: true,
      listOrder: 7,
      workflow: {
        slug: 'client-status',
        initialState: 'onboarding',
        states: [
          { name: 'onboarding', label: 'Onboarding', color: '#F59E0B' },
          { name: 'active', label: 'Active', color: '#10B981' },
          { name: 'dormant', label: 'Dormant', color: '#6B7280' },
        ],
        transitions: [
          // Guarded: a client can only leave onboarding once at least one
          // primary contact exists. Schema enforces exactly-one-primary at
          // create time, but contacts can be deleted afterwards — the guard
          // keeps "active" meaningful even in that degraded state.
          {
            from: 'onboarding',
            to: [{ state: 'active', guardNames: ['require-primary-contact'] }],
          },
          { from: 'active', to: ['dormant'] },
          { from: 'dormant', to: ['active'] },
        ],
      },
    },
    onboardedAt: {
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
    countryId: {
      type: 'category',
      label: 'Country',
      categoryGroupSlug: 'countries',
    },
    notes: {
      type: 'rich_text',
      label: 'Notes',
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Client',
      fields: ['name', 'legalName', 'email', 'phone', 'website', 'taxId', 'industryId', 'accountManagerId', 'status', 'onboardedAt'],
    },
    {
      name: 'Address',
      fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'countryId'],
    },
    {
      name: 'Notes',
      fields: ['notes'],
    },
  ],

  ui: {
    icon: 'Building2',
    navGroup: 'compliance',
    navOrder: 2,
    createMode: 'modal',
    subtitleField: 'legalName',
  },
});
