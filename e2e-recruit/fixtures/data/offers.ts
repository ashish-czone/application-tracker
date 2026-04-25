import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

const STATUSES = ['draft', 'pending-approval', 'approved', 'sent', 'accepted', 'declined', 'expired'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED'];
const PERIODS = ['annual', 'monthly', 'hourly'];

export function generateOffers(count = 30) {
  return Array.from({ length: count }, (_, i) => ({
    id: `offer-${String(i + 1).padStart(3, '0')}`,
    applicationId: `app-${String((i % 10) + 1).padStart(3, '0')}`,
    applicationId__label: `Application #${(i % 10) + 1}`,
    salary: (50000 + i * 5000) * 100, // cents
    salaryCurrency: CURRENCIES[i % CURRENCIES.length],
    salaryPeriod: PERIODS[i % PERIODS.length],
    startDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-01`,
    expiresAt: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
    status: STATUSES[i % STATUSES.length],
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const offerEntity: MockEntity = {
  entityType: 'offers',
  singularName: 'Offer',
  pluralName: 'Offers',
  slug: 'offers',
  icon: 'file-signature',
  nameField: 'applicationId',
  features: {
    softDelete: true,
    restore: true,
    workflow: { hasWorkflow: true, discriminator: null },
  },
};

export const offerListColumns: ListColumn[] = [
  { fieldKey: 'applicationId', label: 'Application', fieldType: 'lookup', sortable: false, visible: true, order: 1, lookupEntity: 'applications' },
  {
    fieldKey: 'status', label: 'Status', fieldType: 'workflow', sortable: true, visible: true, order: 2,
    operators: ['eq', 'neq'],
    picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  { fieldKey: 'salary', label: 'Salary', fieldType: 'currency', sortable: true, visible: true, order: 3 },
  {
    fieldKey: 'salaryPeriod', label: 'Period', fieldType: 'picklist', sortable: false, visible: true, order: 4,
    picklistOptions: PERIODS.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
  },
  { fieldKey: 'startDate', label: 'Start Date', fieldType: 'date', sortable: true, visible: true, order: 5 },
  { fieldKey: 'expiresAt', label: 'Expires At', fieldType: 'date', sortable: true, visible: true, order: 6 },
];

export const offerLayoutSections: LayoutSection[] = [
  {
    id: 'sec-offer-1',
    name: 'Offer Details',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'applicationId', label: 'Application', fieldType: 'lookup', required: true, isQuickCreate: true, lookupEntity: 'applications', columnIndex: 0 },
      {
        fieldKey: 'status', label: 'Status', fieldType: 'workflow', required: false, isQuickCreate: false, columnIndex: 1,
        picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
    ],
  },
  {
    id: 'sec-offer-2',
    name: 'Compensation',
    columns: 2,
    sortOrder: 2,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'salary', label: 'Salary', fieldType: 'currency', required: false, isQuickCreate: false, columnIndex: 0 },
      {
        fieldKey: 'salaryCurrency', label: 'Currency', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 1,
        picklistOptions: CURRENCIES.map((c) => ({ label: c, value: c })),
      },
      {
        fieldKey: 'salaryPeriod', label: 'Period', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 0,
        picklistOptions: PERIODS.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
      },
    ],
  },
  {
    id: 'sec-offer-3',
    name: 'Timeline',
    columns: 2,
    sortOrder: 3,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'startDate', label: 'Start Date', fieldType: 'date', required: false, isQuickCreate: false, columnIndex: 0 },
      { fieldKey: 'expiresAt', label: 'Expires At', fieldType: 'date', required: false, isQuickCreate: false, columnIndex: 1 },
    ],
  },
];

export const offerSearchColumns: string[] = [];
