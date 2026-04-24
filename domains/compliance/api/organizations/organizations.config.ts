import { defineEntity, type EntityConfig } from '@packages/entity-engine';
import { organizations } from '../schema/organizations';

/**
 * Singleton entity — exactly one row may exist. Enforcement of that invariant
 * (and the "cannot delete" rule) lives in `OrganizationsService`, not in
 * engine hooks, since the entity has been fanned out to a dedicated
 * Controller + Service + Module and the engine is only used as a generic CRUD
 * library (`controller: 'none'`).
 */
export const ORGANIZATIONS_CONFIG: EntityConfig<typeof organizations> = defineEntity({
  table: organizations,
  slug: 'organizations',
  singularName: 'Organization',
  pluralName: 'Organizations',
  onDelete: { mode: 'restrict' },
  timestamps: true,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      isLabel: true,
    },
    legalName: {
      type: 'text',
      label: 'Legal Name',
    },
    logoUrl: {
      type: 'file',
      label: 'Logo',
    },
    email: {
      type: 'email',
      label: 'Email',
    },
    phone: {
      type: 'phone',
      label: 'Phone',
    },
    website: {
      type: 'url',
      label: 'Website',
    },
    taxRegistration: {
      type: 'text',
      label: 'Tax Registration',
    },
    fiscalYearStart: {
      type: 'picklist',
      label: 'Fiscal Year Start',
      options: [
        { value: '1', label: 'January' },
        { value: '2', label: 'February' },
        { value: '3', label: 'March' },
        { value: '4', label: 'April' },
        { value: '5', label: 'May' },
        { value: '6', label: 'June' },
        { value: '7', label: 'July' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' },
      ],
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
  },

  sections: [
    {
      name: 'Organization',
      fields: [
        'name',
        'legalName',
        'logoUrl',
        'email',
        'phone',
        'website',
        'taxRegistration',
        'fiscalYearStart',
      ],
    },
    {
      name: 'Address',
      fields: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'countryId'],
    },
  ],

  ui: {
    icon: 'Building',
    createMode: 'page',
  },
});
