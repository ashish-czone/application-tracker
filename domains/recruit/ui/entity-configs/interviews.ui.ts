import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { searchCompaniesForClientPicker, resolveCompanyToClient } from './companyId-picker';

export const INTERVIEWS_UI_CONFIG: EntityUIConfig = {
  entityType: 'interviews',
  presentation: {
    singularName: 'Interview',
    pluralName: 'Interviews',
    icon: 'calendar-check',
    navGroup: 'recruit',
    navOrder: 3,
  },
  fieldUI: {
    interviewName: { label: 'Interview Name' },
    interviewType: { label: 'Interview Type' },
    round: { label: 'Round' },
    candidateId: { label: 'Candidate' },
    companyId: {
      label: 'Client',
      lookupSearch: searchCompaniesForClientPicker,
      lookupResolveValue: resolveCompanyToClient,
    },
    jobOpeningId: { label: 'Job Opening' },
    interviewers: { label: 'Interviewer(s)' },
    interviewFrom: { label: 'Interview From' },
    interviewTo: { label: 'Interview To' },
    duration: { label: 'Duration (min)' },
    location: { label: 'Location' },
    videoLink: { label: 'Video Link' },
    scheduleComments: { label: 'Schedule Comments' },
    status: { label: 'Status', cellRenderer: 'StatusBadge' },
  },
  formLayout: {
    sections: [
      { name: 'Interview Information', fields: ['interviewName', 'interviewType', 'round', 'candidateId', 'companyId', 'jobOpeningId', 'status', 'interviewers'] },
      { name: 'Schedule', fields: ['interviewFrom', 'interviewTo', 'duration', 'location', 'videoLink', 'scheduleComments'] },
    ],
    quickCreateFields: ['interviewName', 'interviewType', 'candidateId', 'jobOpeningId', 'interviewFrom', 'interviewTo'],
  },
  listColumns: [
    { fieldKey: 'interviewName', visible: true, order: 0 },
    { fieldKey: 'candidateId', visible: true, order: 1 },
    { fieldKey: 'interviewFrom', visible: true, order: 2 },
    { fieldKey: 'status', visible: true, order: 3 },
  ],
};
