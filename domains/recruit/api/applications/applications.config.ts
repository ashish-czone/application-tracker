import { sql, isNull } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import { evaluationAvgExpr, evaluationCountExpr, evaluationsFeature } from '@packages/evaluations';
import { applications } from './schema/applications';
import { jobOpenings } from '../job-openings/schema/job-openings';

export const APPLICATIONS_CONFIG: EntityConfig = {
  entityType: 'applications',
  singularName: 'Application',
  pluralName: 'Applications',
  slug: 'applications',

  table: applications,
  features: {
    ...evaluationsFeature(),
  },
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchFields: [],

  defaultSort: 'createdAt',
  sortableFields: ['createdAt', 'stage', 'source'],

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
    source: {
      label: 'Source', section: 'basic', sortOrder: 2, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Career Page', value: 'career-page' },
        { label: 'Referral', value: 'referral' },
        { label: 'LinkedIn', value: 'linkedin' },
        { label: 'Indeed', value: 'indeed' },
        { label: 'Agency', value: 'agency' },
        { label: 'Direct', value: 'direct' },
        { label: 'Job Board', value: 'job-board' },
        { label: 'Social Media', value: 'social-media' },
        { label: 'Other', value: 'other' },
      ],
    },
    referredBy: {
      label: 'Referred By', section: 'basic', sortOrder: 3, fieldType: 'user',
    },
    stage: {
      label: 'Stage', section: 'basic', sortOrder: 4, isSystem: true, fieldType: 'workflow', cellRenderer: 'PipelineProgressRenderer',
      workflow: {
        slug: 'application-stage',
        initialState: 'new',
        states: [
          // 'new' is the applications.stage column default — code-load-bearing.
          // Other states are admin-renameable; demo-automations seeds reference
          // 'phone-screen'/'technical'/'on-site'/'final'/'offer'/'hired' but
          // those are seed-time data, not runtime branching.
          { name: 'new', label: 'New', color: '#6B7280', isSystem: true },
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
    averageRating: { label: 'Avg Rating', section: '_computed', sortOrder: 0, fieldType: 'number', cellRenderer: 'RatingRenderer' },
    evaluationsCount: { label: 'Reviews', section: '_computed', sortOrder: 1, fieldType: 'number' },
  },

  computedColumns: [
    { name: 'averageRating', expression: evaluationAvgExpr('applications', applications.id) },
    { name: 'evaluationsCount', expression: evaluationCountExpr('applications', applications.id) },
  ],

  listFields: ['candidateId', 'jobOpeningId', 'stage', 'source', 'averageRating'],

  sections: [
    { name: 'Basic Info', fields: ['candidateId', 'jobOpeningId', 'stage', 'source', 'referredBy'] },
    { name: 'Details', fields: ['notes'] },
  ],

  dataAccess: {
    anchors: { creator: 'createdBy' },
    scopes: [
      {
        key: 'my-pipeline',
        label: 'Applications for my Job Openings',
        resolve: async (userId) => sql`${applications.jobOpeningId} IN (
          SELECT ${jobOpenings.id} FROM ${jobOpenings} WHERE ${jobOpenings.hiringManager} = ${userId} AND ${jobOpenings.deletedAt} IS NULL
        )`,
      },
    ],
  },

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  nameField: ['candidateId', 'jobOpeningId'],

};
