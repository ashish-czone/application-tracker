import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

const TYPES = ['phone', 'video', 'on-site', 'panel', 'take-home', 'technical', 'hr'];
const STATUSES = ['scheduled', 'completed', 'cancelled', 'no-show', 'rescheduled'];

export function generateInterviews(count = 30) {
  const candidateNames = ['James Anderson', 'Sarah Thompson', 'Michael Garcia', 'Emily Martinez', 'David Robinson'];
  const jobTitles = ['Senior Frontend Developer', 'Backend Engineer', 'Product Manager', 'UX Designer', 'DevOps Engineer'];

  return Array.from({ length: count }, (_, i) => ({
    id: `interview-${String(i + 1).padStart(3, '0')}`,
    interviewName: `Interview ${i + 1} - ${candidateNames[i % candidateNames.length]}`,
    interviewType: TYPES[i % TYPES.length],
    candidateId: `cand-${String((i % 5) + 1).padStart(3, '0')}`,
    candidateId__label: candidateNames[i % candidateNames.length],
    jobOpeningId: `job-${String((i % 5) + 1).padStart(3, '0')}`,
    jobOpeningId__label: jobTitles[i % jobTitles.length],
    interviewFrom: new Date(2026, 1, i + 1, 10, 0).toISOString(),
    round: (i % 3) + 1,
    status: STATUSES[i % STATUSES.length],
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const interviewEntity: MockEntity = {
  entityType: 'interviews',
  singularName: 'Interview',
  pluralName: 'Interviews',
  slug: 'interviews',
  icon: 'calendar-check',
  nameField: 'interviewName',
};

export const interviewListColumns: ListColumn[] = [
  { fieldKey: 'interviewName', label: 'Interview Name', fieldType: 'text', sortable: true, visible: true, order: 1 },
  {
    fieldKey: 'interviewType', label: 'Type', fieldType: 'picklist', sortable: true, visible: true, order: 2,
    operators: ['eq', 'neq'],
    picklistOptions: TYPES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  { fieldKey: 'candidateId', label: 'Candidate', fieldType: 'lookup', sortable: false, visible: true, order: 3, lookupEntity: 'candidates' },
  { fieldKey: 'jobOpeningId', label: 'Job Opening', fieldType: 'lookup', sortable: false, visible: true, order: 4, lookupEntity: 'job_openings' },
  { fieldKey: 'interviewFrom', label: 'Interview Date', fieldType: 'datetime', sortable: true, visible: true, order: 5 },
  { fieldKey: 'round', label: 'Round', fieldType: 'number', sortable: true, visible: true, order: 6 },
  {
    fieldKey: 'status', label: 'Status', fieldType: 'picklist', sortable: true, visible: true, order: 7,
    operators: ['eq', 'neq'],
    picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
    cellRenderer: 'StatusBadge',
  },
];

export const interviewLayoutSections: LayoutSection[] = [
  {
    id: 'sec-intv-1',
    name: 'Interview Information',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'interviewName', label: 'Interview Name', fieldType: 'text', required: true, isQuickCreate: true, columnIndex: 0 },
      {
        fieldKey: 'interviewType', label: 'Type', fieldType: 'picklist', required: true, isQuickCreate: true, columnIndex: 1,
        picklistOptions: TYPES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
      { fieldKey: 'candidateId', label: 'Candidate', fieldType: 'lookup', required: true, isQuickCreate: true, lookupEntity: 'candidates', columnIndex: 0 },
      { fieldKey: 'jobOpeningId', label: 'Job Opening', fieldType: 'lookup', required: true, isQuickCreate: true, lookupEntity: 'job_openings', columnIndex: 1 },
      { fieldKey: 'interviewFrom', label: 'From', fieldType: 'datetime', required: true, isQuickCreate: true, columnIndex: 0 },
      { fieldKey: 'interviewTo', label: 'To', fieldType: 'datetime', required: true, isQuickCreate: true, columnIndex: 1 },
    ],
  },
  {
    id: 'sec-intv-2',
    name: 'Schedule',
    columns: 2,
    sortOrder: 2,
    isCollapsible: true,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'location', label: 'Location', fieldType: 'text', required: false, isQuickCreate: false, columnIndex: 0 },
      { fieldKey: 'videoLink', label: 'Video Link', fieldType: 'url', required: false, isQuickCreate: false, columnIndex: 1 },
      { fieldKey: 'scheduleComments', label: 'Comments', fieldType: 'textarea', required: false, isQuickCreate: false, columnIndex: 0 },
    ],
  },
];

export const interviewSearchColumns = ['interviewName', 'location'];
