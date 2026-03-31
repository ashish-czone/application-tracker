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
    stage: {
      label: 'Stage', section: 'basic', sortOrder: 2, isSystem: true, fieldType: 'workflow', cellRenderer: 'PipelineProgressRenderer',
      workflow: {
        slug: 'application-stage',
        initialState: 'new',
        states: [
          { name: 'new', label: 'New', color: '#6B7280' },
          { name: 'phone-screen', label: 'Phone Screen', color: '#3B82F6' },
          { name: 'technical', label: 'Technical', color: '#8B5CF6' },
          { name: 'on-site', label: 'On-site', color: '#F59E0B' },
          { name: 'final', label: 'Final', color: '#EC4899' },
          { name: 'offer', label: 'Offer', color: '#10B981' },
          { name: 'hired', label: 'Hired', color: '#059669' },
          { name: 'rejected', label: 'Rejected', color: '#EF4444' },
          { name: 'withdrawn', label: 'Withdrawn', color: '#9CA3AF' },
        ],
        transitions: [
          { from: 'new', to: ['phone-screen', 'rejected', 'withdrawn'] },
          { from: 'phone-screen', to: ['technical', 'rejected', 'withdrawn'] },
          { from: 'technical', to: ['on-site', 'rejected', 'withdrawn'] },
          { from: 'on-site', to: ['final', 'rejected', 'withdrawn'] },
          { from: 'final', to: ['offer', 'rejected', 'withdrawn'] },
          { from: 'offer', to: ['hired', 'rejected', 'withdrawn'] },
        ],
        discriminator: {
          key: 'client-country',
          label: 'Client Country',
          options: [
            { value: 'United States', label: 'United States' },
            { value: 'United Kingdom', label: 'United Kingdom' },
          ],
          resolve: async (entityData, { findEntity, findCategory }) => {
            const jobOpeningId = entityData.jobOpeningId as string;
            if (!jobOpeningId) return '';
            const jobOpening = await findEntity('job_openings', jobOpeningId);
            const clientId = jobOpening.clientId as string;
            if (!clientId) return '';
            const client = await findEntity('clients', clientId);
            const categoryId = client.billingCountry as string;
            if (!categoryId) return '';
            const category = await findCategory(categoryId);
            return category?.name ?? '';
          },
        },
      },
    },
    notes: { label: 'Notes', section: 'details', sortOrder: 0, fieldType: 'textarea', maxLength: 5000 },
  },

  listFields: ['candidateId', 'jobOpeningId', 'stage'],

  sections: [
    { name: 'Basic Info', fields: ['candidateId', 'jobOpeningId', 'stage'] },
    { name: 'Details', fields: ['notes'] },
  ],

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  ui: {
    icon: 'file-text',
    nameField: ['candidateId', 'jobOpeningId'],
    navGroup: 'recruit',
    navOrder: 3,
  },

};
