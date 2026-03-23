import { eq } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import { applications } from './schema/applications';

export const APPLICATIONS_CONFIG: EntityConfig = {
  entityType: 'applications',
  singularName: 'Application',
  pluralName: 'Applications',
  slug: 'applications',

  table: applications,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchColumns: [],

  defaultSort: 'createdAt',
  sortableColumns: {
    createdAt: applications.createdAt,
    status: applications.status,
    stage: applications.stage,
  },

  fieldMeta: {
    candidateId: {
      label: 'Candidate', section: 'basic', sortOrder: 0, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'candidates', lookupLabelField: 'firstName',
      lookupSearchFields: ['firstName', 'lastName', 'email'],
    },
    jobOpeningId: {
      label: 'Job Opening', section: 'basic', sortOrder: 1, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'job_openings', lookupLabelField: 'title',
      lookupSearchFields: ['title', 'department'],
    },
    status: {
      label: 'Status', section: 'basic', sortOrder: 2, isQuickCreate: true, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Applied', value: 'applied' },
        { label: 'Screening', value: 'screening' },
        { label: 'Interview', value: 'interview' },
        { label: 'Offered', value: 'offered' },
        { label: 'Hired', value: 'hired' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
    stage: {
      label: 'Stage', section: 'basic', sortOrder: 3, fieldType: 'picklist',
      picklistOptions: [
        { label: 'New', value: 'new' },
        { label: 'Phone Screen', value: 'phone-screen' },
        { label: 'Technical', value: 'technical' },
        { label: 'On-site', value: 'on-site' },
        { label: 'Final', value: 'final' },
      ],
    },
    notes: { label: 'Notes', section: 'details', sortOrder: 0, fieldType: 'textarea', maxLength: 5000 },
  },

  sections: [
    { name: 'Basic Info', fields: ['candidateId', 'jobOpeningId', 'status', 'stage'] },
    { name: 'Details', fields: ['notes'] },
  ],

  features: {
    softDelete: true,
  },

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  ui: {
    icon: 'file-text',
    nameField: 'status',
    navGroup: 'recruit',
    navOrder: 3,
  },

  hooks: {
    buildListFilters: (query) => {
      const filters: any[] = [];
      if (query.status) filters.push(eq(applications.status, query.status as string));
      if (query.candidateId) filters.push(eq(applications.candidateId, query.candidateId as string));
      if (query.jobOpeningId) filters.push(eq(applications.jobOpeningId, query.jobOpeningId as string));
      return filters;
    },
  },
};
