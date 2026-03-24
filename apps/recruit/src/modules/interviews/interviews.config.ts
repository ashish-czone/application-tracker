import type { EntityConfig } from '@packages/entity-engine';
import { interviews } from './schema/interviews';

export const INTERVIEWS_CONFIG: EntityConfig = {
  entityType: 'interviews',
  singularName: 'Interview',
  pluralName: 'Interviews',
  slug: 'interviews',

  table: interviews,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchColumns: [interviews.interviewName, interviews.location],

  defaultSort: 'interviewFrom',
  sortableColumns: {
    interviewName: interviews.interviewName,
    interviewFrom: interviews.interviewFrom,
    status: interviews.status,
    createdAt: interviews.createdAt,
  },

  fieldMeta: {
    interviewName: {
      label: 'Interview Name', section: 'basic', sortOrder: 0, isQuickCreate: true, isSystem: true, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Internal Interview', value: 'internal-interview' },
        { label: 'General Interview', value: 'general-interview' },
        { label: 'Online Interview', value: 'online-interview' },
        { label: 'Phone Interview', value: 'phone-interview' },
        { label: 'Level 1 Interview', value: 'level-1-interview' },
        { label: 'Level 2 Interview', value: 'level-2-interview' },
        { label: 'Level 3 Interview', value: 'level-3-interview' },
        { label: 'Level 4 Interview', value: 'level-4-interview' },
      ],
    },
    candidateId: {
      label: 'Candidate', section: 'basic', sortOrder: 1, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'candidates', lookupLabelField: 'firstName',
      lookupSearchFields: ['firstName', 'lastName', 'email'],
    },
    clientId: {
      label: 'Client', section: 'basic', sortOrder: 2, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'clients', lookupLabelField: 'clientName',
      lookupSearchFields: ['clientName'],
    },
    jobOpeningId: {
      label: 'Job Opening', section: 'basic', sortOrder: 3, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'job_openings', lookupLabelField: 'title',
      lookupSearchFields: ['title', 'department'],
    },
    interviewFrom: { label: 'From', section: 'basic', sortOrder: 4, isQuickCreate: true, fieldType: 'datetime' },
    interviewTo: { label: 'To', section: 'basic', sortOrder: 5, isQuickCreate: true, fieldType: 'datetime' },
    location: { label: 'Location', section: 'basic', sortOrder: 6 },
    scheduleComments: { label: 'Schedule Comments', section: 'basic', sortOrder: 7, fieldType: 'textarea', maxLength: 32000 },
    status: {
      label: 'Status', section: 'basic', sortOrder: 8, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'No Show', value: 'no-show' },
        { label: 'Rescheduled', value: 'rescheduled' },
      ],
    },
  },

  sections: [
    { name: 'Interview Information', fields: ['interviewName', 'candidateId', 'clientId', 'jobOpeningId', 'interviewFrom', 'interviewTo', 'location', 'scheduleComments', 'status'] },
  ],

  recipientFields: {
    createdBy: { label: 'Created By' },
  },

  ui: {
    icon: 'calendar-check',
    nameField: 'interviewName',
    navGroup: 'recruit',
    navOrder: 3,
  },
};
