import type { EntityConfig } from '@packages/entity-engine';
import { offers } from './schema/offers';

export const offersConfig: EntityConfig = {
  entityType: 'offers',
  singularName: 'Offer',
  pluralName: 'Offers',
  slug: 'offers',

  table: offers,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchColumns: [],

  defaultSort: 'createdAt',
  sortableColumns: {
    createdAt: offers.createdAt,
    status: offers.status,
    startDate: offers.startDate,
  },

  fieldMeta: {
    applicationId: {
      label: 'Application', section: 'basic', sortOrder: 0, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'applications', lookupLabelField: 'id',
      lookupSearchFields: ['id'],
    },
    salary: {
      label: 'Salary', section: 'compensation', sortOrder: 0, fieldType: 'currency',
    },
    salaryCurrency: {
      label: 'Currency', section: 'compensation', sortOrder: 1, fieldType: 'picklist',
      picklistOptions: [
        { label: 'USD', value: 'USD' },
        { label: 'EUR', value: 'EUR' },
        { label: 'GBP', value: 'GBP' },
        { label: 'INR', value: 'INR' },
        { label: 'AED', value: 'AED' },
        { label: 'CAD', value: 'CAD' },
        { label: 'AUD', value: 'AUD' },
      ],
    },
    salaryPeriod: {
      label: 'Period', section: 'compensation', sortOrder: 2, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Annual', value: 'annual' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Hourly', value: 'hourly' },
      ],
    },
    signingBonus: {
      label: 'Signing Bonus', section: 'compensation', sortOrder: 3, fieldType: 'currency',
    },
    equity: {
      label: 'Equity', section: 'compensation', sortOrder: 4, fieldType: 'text',
    },
    startDate: {
      label: 'Start Date', section: 'timeline', sortOrder: 0, fieldType: 'date',
    },
    expiresAt: {
      label: 'Expires', section: 'timeline', sortOrder: 1, fieldType: 'date',
    },
    sentAt: {
      label: 'Sent At', section: 'timeline', sortOrder: 2, fieldType: 'datetime',
    },
    respondedAt: {
      label: 'Responded At', section: 'timeline', sortOrder: 3, fieldType: 'datetime',
    },
    status: {
      label: 'Status', section: 'basic', sortOrder: 1, isSystem: true, fieldType: 'workflow',
      workflow: {
        slug: 'offer-status',
        initialState: 'draft',
        states: [
          { name: 'draft', label: 'Draft', color: '#6B7280' },
          { name: 'pending-approval', label: 'Pending Approval', color: '#F59E0B' },
          { name: 'approved', label: 'Approved', color: '#3B82F6' },
          { name: 'sent', label: 'Sent', color: '#8B5CF6' },
          { name: 'accepted', label: 'Accepted', color: '#10B981' },
          { name: 'declined', label: 'Declined', color: '#EF4444' },
          { name: 'expired', label: 'Expired', color: '#9CA3AF' },
        ],
        transitions: [
          { from: 'draft', to: ['pending-approval'] },
          { from: 'pending-approval', to: [{ state: 'approved', guardNames: ['require-offer-approvals'] }, 'draft'] },
          { from: 'approved', to: ['sent'] },
          { from: 'sent', to: ['accepted', 'declined', 'expired'] },
        ],
      },
    },
    approvedBy: {
      label: 'Approved By', section: 'approval', sortOrder: 0, fieldType: 'user',
    },
    notes: {
      label: 'Notes', section: 'details', sortOrder: 0, fieldType: 'textarea', maxLength: 5000,
    },
  },

  listFields: ['status', 'salary', 'salaryPeriod', 'startDate', 'expiresAt'],

  sections: [
    { name: 'Offer Details', fields: ['applicationId', 'status'] },
    { name: 'Compensation', fields: ['salary', 'salaryCurrency', 'salaryPeriod', 'signingBonus', 'equity'] },
    { name: 'Timeline', fields: ['startDate', 'expiresAt', 'sentAt', 'respondedAt'] },
    { name: 'Approval', fields: ['approvedBy'] },
    { name: 'Notes', fields: ['notes'] },
  ],

  dataAccess: {
    anchors: { creator: 'createdBy' },
  },

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  ui: {
    icon: 'file-signature',
    nameField: 'status',
    navGroup: 'recruit',
    navOrder: 4,
  },
};
