import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

const STAGES = ['new', 'phone-screen', 'technical', 'on-site', 'final', 'offer', 'hired', 'rejected', 'withdrawn'];
const SOURCES = ['career-page', 'referral', 'linkedin', 'indeed', 'agency', 'direct', 'job-board'];

export function generateApplications(count = 30) {
  const candidateNames = ['James Anderson', 'Sarah Thompson', 'Michael Garcia', 'Emily Martinez', 'David Robinson'];
  const jobTitles = ['Senior Frontend Developer', 'Backend Engineer', 'Product Manager', 'UX Designer', 'DevOps Engineer'];

  return Array.from({ length: count }, (_, i) => ({
    id: `app-${String(i + 1).padStart(3, '0')}`,
    candidateId: `cand-${String((i % 5) + 1).padStart(3, '0')}`,
    candidateId__label: candidateNames[i % candidateNames.length],
    jobOpeningId: `job-${String((i % 5) + 1).padStart(3, '0')}`,
    jobOpeningId__label: jobTitles[i % jobTitles.length],
    stage: STAGES[i % STAGES.length],
    source: SOURCES[i % SOURCES.length],
    averageRating: (i % 5) + 1,
    evaluationsCount: i % 3,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const applicationEntity: MockEntity = {
  entityType: 'applications',
  singularName: 'Application',
  pluralName: 'Applications',
  slug: 'applications',
  icon: 'file-text',
  nameField: ['candidateId', 'jobOpeningId'],
  features: {
    hasEvaluations: true,
    softDelete: true,
    restore: true,
    workflow: { hasWorkflow: true, discriminator: null },
  },
};

export const applicationListColumns: ListColumn[] = [
  { fieldKey: 'candidateId', label: 'Candidate', fieldType: 'lookup', sortable: false, visible: true, order: 1, lookupEntity: 'candidates' },
  { fieldKey: 'jobOpeningId', label: 'Job Opening', fieldType: 'lookup', sortable: false, visible: true, order: 2, lookupEntity: 'job_openings' },
  {
    fieldKey: 'stage', label: 'Stage', fieldType: 'workflow', sortable: true, visible: true, order: 3,
    cellRenderer: 'PipelineProgressRenderer',
    operators: ['eq', 'neq'],
    picklistOptions: STAGES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  {
    fieldKey: 'source', label: 'Source', fieldType: 'picklist', sortable: true, visible: true, order: 4,
    operators: ['eq', 'neq'],
    picklistOptions: SOURCES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  { fieldKey: 'averageRating', label: 'Avg Rating', fieldType: 'number', sortable: false, visible: true, order: 5, cellRenderer: 'RatingRenderer' },
];

export const applicationLayoutSections: LayoutSection[] = [
  {
    id: 'sec-app-1',
    name: 'Basic Info',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'candidateId', label: 'Candidate', fieldType: 'lookup', required: true, isQuickCreate: true, lookupEntity: 'candidates', columnIndex: 0 },
      { fieldKey: 'jobOpeningId', label: 'Job Opening', fieldType: 'lookup', required: true, isQuickCreate: true, lookupEntity: 'job_openings', columnIndex: 1 },
      {
        fieldKey: 'source', label: 'Source', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 0,
        picklistOptions: SOURCES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
      { fieldKey: 'referredBy', label: 'Referred By', fieldType: 'user', required: false, isQuickCreate: false, columnIndex: 1 },
    ],
  },
  {
    id: 'sec-app-2',
    name: 'Details',
    columns: 1,
    sortOrder: 2,
    isCollapsible: true,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'notes', label: 'Notes', fieldType: 'textarea', required: false, isQuickCreate: false, columnIndex: 0 },
    ],
  },
];

export const applicationSearchColumns: string[] = [];
