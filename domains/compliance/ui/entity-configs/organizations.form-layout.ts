import { defineFormLayout } from '@packages/entity-views-ui';

const FISCAL_YEAR_START_OPTIONS = [
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
];

/**
 * Static form layout for the Organization entity. Replaces what
 * `useEntityLayout('organizations')` used to fetch from
 * `GET /layouts/organizations`. Field metadata is duplicated relative to
 * `ORGANIZATIONS_CONFIG` in the api package; that's the temporary cost
 * of the migration. When `defineEntity` is fully retired, the api side
 * will stop carrying form-presentation metadata and the duplication
 * dissolves.
 */
export const ORGANIZATIONS_FORM_LAYOUT = defineFormLayout({
  entity: 'organizations',
  sections: [
    {
      name: 'Organization',
      columns: 2,
      fields: [
        { fieldKey: 'name', label: 'Name', fieldType: 'text', isRequired: true },
        { fieldKey: 'legalName', label: 'Legal Name', fieldType: 'text' },
        { fieldKey: 'logoUrl', label: 'Logo', fieldType: 'file' },
        { fieldKey: 'email', label: 'Email', fieldType: 'email' },
        { fieldKey: 'phone', label: 'Phone', fieldType: 'phone' },
        { fieldKey: 'website', label: 'Website', fieldType: 'url' },
        { fieldKey: 'taxRegistration', label: 'Tax Registration', fieldType: 'text' },
        {
          fieldKey: 'fiscalYearStart',
          label: 'Fiscal Year Start',
          fieldType: 'picklist',
          picklistOptions: FISCAL_YEAR_START_OPTIONS,
        },
      ],
    },
    {
      name: 'Address',
      columns: 2,
      fields: [
        { fieldKey: 'addressLine1', label: 'Address Line 1', fieldType: 'text' },
        { fieldKey: 'addressLine2', label: 'Address Line 2', fieldType: 'text' },
        { fieldKey: 'city', label: 'City', fieldType: 'text' },
        { fieldKey: 'state', label: 'State / Province', fieldType: 'text' },
        { fieldKey: 'postalCode', label: 'Postal Code', fieldType: 'text' },
        {
          fieldKey: 'countryId',
          label: 'Country',
          fieldType: 'category',
          categoryGroupSlug: 'countries',
        },
      ],
    },
  ],
});
