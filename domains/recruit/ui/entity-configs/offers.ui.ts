import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { OfferApprovalPanel } from '../portals/recruiter/features/offers/OfferApprovalPanel';

export const OFFERS_UI_CONFIG: EntityUIConfig = {
  entityType: 'offers',
  presentation: {
    singularName: 'Offer',
    pluralName: 'Offers',
    icon: 'file-signature',
    navGroup: 'recruit',
    navOrder: 4,
  },
  fieldUI: {
    applicationId: { label: 'Application' },
    salary: { label: 'Salary' },
    salaryCurrency: { label: 'Currency' },
    salaryPeriod: { label: 'Period' },
    signingBonus: { label: 'Signing Bonus' },
    equity: { label: 'Equity' },
    startDate: { label: 'Start Date' },
    expiresAt: { label: 'Expires' },
    sentAt: { label: 'Sent At' },
    respondedAt: { label: 'Responded At' },
    status: { label: 'Status' },
    approvedBy: { label: 'Approved By' },
    notes: { label: 'Notes' },
  },
  formLayout: {
    sections: [
      { name: 'Offer Details', fields: ['applicationId', 'status'] },
      { name: 'Compensation', fields: ['salary', 'salaryCurrency', 'salaryPeriod', 'signingBonus', 'equity'] },
      { name: 'Timeline', fields: ['startDate', 'expiresAt', 'sentAt', 'respondedAt'] },
      { name: 'Approval', fields: ['approvedBy'] },
      { name: 'Notes', fields: ['notes'] },
    ],
    quickCreateFields: ['applicationId'],
  },
  listColumns: [
    { fieldKey: 'status', visible: true, order: 0 },
    { fieldKey: 'salary', visible: true, order: 1 },
    { fieldKey: 'salaryPeriod', visible: true, order: 2 },
    { fieldKey: 'startDate', visible: true, order: 3 },
    { fieldKey: 'expiresAt', visible: true, order: 4 },
  ],
  detailPlugins: [
    { component: OfferApprovalPanel as any, label: 'Approval Chain', order: 0 },
  ],
};
