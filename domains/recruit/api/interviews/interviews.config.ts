import { sql } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import { interviews } from './schema/interviews';
import { jobOpenings } from '../job-openings/schema/job-openings';

export const INTERVIEWS_CONFIG: EntityConfig = {
  entityType: 'interviews',
  slug: 'interviews',

  table: interviews,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchFields: ['interviewName', 'location'],

  defaultSort: 'interviewFrom',
  sortableFields: ['interviewName', 'interviewType', 'round', 'interviewFrom', 'status', 'createdAt'],

  fieldMeta: {
    interviewName: {
      label: 'Interview Name', section: 'basic', sortOrder: 0, isQuickCreate: true,
    },
    interviewType: {
      label: 'Interview Type', section: 'basic', sortOrder: 1, isQuickCreate: true, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Phone', value: 'phone' },
        { label: 'Video', value: 'video' },
        { label: 'On-site', value: 'on-site' },
        { label: 'Panel', value: 'panel' },
        { label: 'Take-home', value: 'take-home' },
        { label: 'Technical', value: 'technical' },
        { label: 'HR', value: 'hr' },
      ],
    },
    round: {
      label: 'Round', section: 'basic', sortOrder: 2, fieldType: 'number',
    },
    candidateId: {
      label: 'Candidate', section: 'basic', sortOrder: 3, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'candidates', lookupLabelField: 'firstName',
      lookupSearchFields: ['firstName', 'lastName', 'email'],
    },
    clientId: {
      label: 'Client', section: 'basic', sortOrder: 4,
      fieldType: 'lookup', lookupEntity: 'clients',
    },
    jobOpeningId: {
      label: 'Job Opening', section: 'basic', sortOrder: 5, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'job_openings', lookupLabelField: 'title',
      lookupSearchFields: ['title', 'department'],
    },
    interviewers: {
      label: 'Interviewer(s)', section: 'basic', sortOrder: 7, fieldType: 'multi_user',
    },
    interviewFrom: { label: 'Interview From', section: 'schedule', sortOrder: 0, isQuickCreate: true, fieldType: 'datetime' },
    interviewTo: { label: 'Interview To', section: 'schedule', sortOrder: 1, isQuickCreate: true, fieldType: 'datetime' },
    duration: { label: 'Duration (min)', section: 'schedule', sortOrder: 2, fieldType: 'number' },
    location: { label: 'Location', section: 'schedule', sortOrder: 3 },
    videoLink: { label: 'Video Link', section: 'schedule', sortOrder: 4, fieldType: 'url' },
    scheduleComments: { label: 'Schedule Comments', section: 'schedule', sortOrder: 5, fieldType: 'textarea', maxLength: 32000 },
    status: {
      label: 'Status', section: 'basic', sortOrder: 6, fieldType: 'picklist', cellRenderer: 'StatusBadge',
      picklistOptions: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'No Show', value: 'no-show' },
        { label: 'Rescheduled', value: 'rescheduled' },
      ],
    },
  },

  listFields: ['interviewName', 'candidateId', 'interviewFrom', 'status'],

  sections: [
    { name: 'Interview Information', fields: ['interviewName', 'interviewType', 'round', 'candidateId', 'clientId', 'jobOpeningId', 'status', 'interviewers'] },
    { name: 'Schedule', fields: ['interviewFrom', 'interviewTo', 'duration', 'location', 'videoLink', 'scheduleComments'] },
  ],

  dataAccess: {
    anchors: { creator: 'createdBy' },
    scopes: [
      {
        key: 'my-job-interviews',
        label: 'Interviews for my Job Openings',
        resolve: (userId) => sql`${interviews.jobOpeningId} IN (
          SELECT ${jobOpenings.id} FROM ${jobOpenings} WHERE ${jobOpenings.hiringManager} = ${userId} AND ${jobOpenings.deletedAt} IS NULL
        )`,
      },
    ],
  },

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  nameField: 'interviewName',
};
