import { sql } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import { contacts } from './schema/contacts';

export const CONTACTS_CONFIG: EntityConfig = {
  entityType: 'contacts',
  singularName: 'Contact',
  pluralName: 'Contacts',
  slug: 'contacts',

  table: contacts,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchColumns: [contacts.firstName, contacts.lastName, contacts.email],

  defaultSort: 'lastName',
  sortableColumns: {
    lastName: contacts.lastName,
    email: contacts.email,
    createdAt: contacts.createdAt,
  },

  fieldMeta: {
    fullName: { label: 'Contact', isSystem: true, cellRenderer: 'AvatarNameCell' },
    firstName: { label: 'First Name', section: 'basic', sortOrder: 0, isQuickCreate: true, maxLength: 125 },
    lastName: { label: 'Last Name', section: 'basic', sortOrder: 1, isQuickCreate: true, isSystem: true, maxLength: 125 },
    clientId: {
      label: 'Client Name', section: 'basic', sortOrder: 2, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'clients', lookupLabelField: 'clientName',
      lookupSearchFields: ['clientName'],
    },
    department: { label: 'Department', section: 'basic', sortOrder: 3, maxLength: 50 },
    email: { label: 'Email', section: 'basic', sortOrder: 4, isQuickCreate: true, fieldType: 'email' },
    secondaryEmail: { label: 'Secondary Email', section: 'basic', sortOrder: 5, fieldType: 'email' },
    jobTitle: { label: 'Job Title', section: 'basic', sortOrder: 6, maxLength: 100 },
    workPhone: { label: 'Work Phone', section: 'basic', sortOrder: 7, isQuickCreate: true, fieldType: 'phone' },
    mobile: { label: 'Mobile', section: 'basic', sortOrder: 8, isQuickCreate: true, fieldType: 'phone' },
    // Mailing Address
    mailingStreet: { label: 'Mailing Street', section: 'mailing-address', sortOrder: 0 },
    mailingCity: { label: 'Mailing City', section: 'mailing-address', sortOrder: 1 },
    mailingProvince: { label: 'Mailing Province', section: 'mailing-address', sortOrder: 2 },
    mailingPostalCode: { label: 'Mailing Postal Code', section: 'mailing-address', sortOrder: 3 },
    mailingCountry: { label: 'Mailing Country', section: 'mailing-address', sortOrder: 4 },
    // Other Address
    otherStreet: { label: 'Other Street', section: 'other-address', sortOrder: 0 },
    otherCity: { label: 'Other City', section: 'other-address', sortOrder: 1 },
    otherProvince: { label: 'Other Province', section: 'other-address', sortOrder: 2 },
    otherPostalCode: { label: 'Other Postal Code', section: 'other-address', sortOrder: 3 },
    otherCountry: { label: 'Other Country', section: 'other-address', sortOrder: 4 },
    // Social
    linkedinUrl: { label: 'LinkedIn', section: 'social', sortOrder: 0, fieldType: 'url' },
    facebookUrl: { label: 'Facebook', section: 'social', sortOrder: 1, fieldType: 'url' },
    twitterHandle: { label: 'Twitter', section: 'social', sortOrder: 2, maxLength: 50 },
    // Other Info
    source: {
      label: 'Source', section: 'other', sortOrder: 0, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Added by User', value: 'added-by-user' },
        { label: 'Advertisement', value: 'advertisement' },
        { label: 'API', value: 'api' },
        { label: 'Cold Call', value: 'cold-call' },
        { label: 'Employee Referral', value: 'employee-referral' },
        { label: 'External Referral', value: 'external-referral' },
        { label: 'Import', value: 'import' },
        { label: 'Partner', value: 'partner' },
        { label: 'Web Form', value: 'web-form' },
      ],
    },
    isPrimaryContact: { label: 'Is Primary Contact', section: 'other', sortOrder: 1, fieldType: 'boolean' },
    emailOptOut: { label: 'Email Opt Out', section: 'other', sortOrder: 2, fieldType: 'boolean' },
  },

  computedColumns: [
    { name: 'fullName', expression: sql`TRIM(COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, ''))`, sourceFields: ['firstName', 'lastName'] },
  ],

  listFields: ['fullName', 'clientId', 'email', 'mobile', 'jobTitle'],

  sections: [
    { name: 'Contact Information', fields: ['firstName', 'lastName', 'clientId', 'department', 'email', 'secondaryEmail', 'jobTitle', 'workPhone', 'mobile'] },
    { name: 'Mailing Address', fields: ['mailingStreet', 'mailingCity', 'mailingProvince', 'mailingPostalCode', 'mailingCountry'] },
    { name: 'Other Address', fields: ['otherStreet', 'otherCity', 'otherProvince', 'otherPostalCode', 'otherCountry'] },
    { name: 'Social Links', fields: ['linkedinUrl', 'facebookUrl', 'twitterHandle'] },
    { name: 'Other Info', fields: ['source', 'isPrimaryContact', 'emailOptOut'] },
  ],

  lookup: {
    labelField: 'lastName',
    searchFields: ['firstName', 'lastName', 'email'],
  },

  dataAccess: { anchors: { creator: 'createdBy' } },

  recipientFields: { createdBy: { label: 'Created By' } },

  nameField: 'fullName',
};
