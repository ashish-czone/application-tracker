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
          // All three states are code-load-bearing: ClientsService.CLIENT_GUARDS
          // and client-registrations.service filter on these names. Renaming
          // any of them silently breaks domain logic, so isSystem locks the
          // identifier in the admin UI (label/color stay editable).
          { name: 'onboarding', label: 'Onboarding', color: '#F59E0B', isSystem: true },
          { name: 'active', label: 'Active', color: '#10B981', isSystem: true },
          { name: 'dormant', label: 'Dormant', color: '#6B7280', isSystem: true },
        ],
        transitions: [
          // Guards (require-primary-contact, compliance-client-dormancy-warning)
          // live in ClientsService.CLIENT_GUARDS — the workflow definition only
          // describes legal transitions and which require reason/comment.
          { from: 'onboarding', to: ['active'] },
          // Dormancy is destructive per Q6: it cascades `cancelled` across
          // every non-terminal filing for this client inside the transition
          // tx. Forcing a reason + comment makes the admin articulate *why*
          // and that explanation propagates into each filing's workflow
          // history so the audit trail reads standalone on every row.
          {
            from: 'active',
            to: [{
              state: 'dormant',
              reasonRequired: true,
              commentRequired: true,
            }],
          },
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
});
