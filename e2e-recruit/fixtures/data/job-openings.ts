import type { MockEntity, ListColumn, LayoutSection } from '../mock-api';

const STATUSES = ['in-progress', 'waiting-for-approval', 'on-hold', 'filled', 'cancelled', 'declined', 'inactive'];
const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary'];

export function generateJobOpenings(count = 30) {
  const titles = [
    'Senior Frontend Developer', 'Backend Engineer', 'Product Manager', 'UX Designer',
    'DevOps Engineer', 'Data Scientist', 'QA Lead', 'Engineering Manager',
    'Full Stack Developer', 'Mobile Developer', 'Cloud Architect', 'Security Engineer',
    'ML Engineer', 'Technical Writer', 'Scrum Master',
  ];
  const departments = ['Engineering', 'Product', 'Design', 'QA', 'Infrastructure', 'Data'];
  const locations = ['New York', 'San Francisco', 'London', 'Dubai', 'Singapore', 'Remote'];

  return Array.from({ length: count }, (_, i) => ({
    id: `job-${String(i + 1).padStart(3, '0')}`,
    title: titles[i % titles.length],
    clientId: `client-${String((i % 5) + 1).padStart(3, '0')}`,
    clientId__label: ['Acme Corp', 'TechVentures', 'GlobalSoft', 'InnovateCo', 'DataDriven'][i % 5],
    department: departments[i % departments.length],
    location: locations[i % locations.length],
    status: STATUSES[i % STATUSES.length],
    targetDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
    employmentType: EMPLOYMENT_TYPES[i % EMPLOYMENT_TYPES.length],
    numberOfPositions: (i % 5) + 1,
    applicationsCount: i % 8,
    interviewsCount: i % 4,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const jobOpeningEntity: MockEntity = {
  entityType: 'job_openings',
  singularName: 'Job Opening',
  pluralName: 'Job Openings',
  slug: 'job-openings',
  icon: 'briefcase',
  nameField: 'title',
  createMode: 'page',
  features: { softDelete: true, restore: true },
  relationships: [
    { name: 'applications', type: 'hasMany', targetEntity: 'applications', foreignKey: 'jobOpeningId', label: 'Applications' },
    { name: 'interviews', type: 'hasMany', targetEntity: 'interviews', foreignKey: 'jobOpeningId', label: 'Interviews' },
  ],
};

export const jobOpeningListColumns: ListColumn[] = [
  { fieldKey: 'title', label: 'Title', fieldType: 'text', sortable: true, visible: true, order: 1 },
  { fieldKey: 'clientId', label: 'Client', fieldType: 'lookup', sortable: false, visible: true, order: 2, lookupEntity: 'clients' },
  { fieldKey: 'department', label: 'Department', fieldType: 'category', sortable: true, visible: true, order: 3, categoryGroupSlug: 'departments' },
  {
    fieldKey: 'status', label: 'Status', fieldType: 'picklist', sortable: true, visible: true, order: 4,
    operators: ['eq', 'neq'],
    picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  { fieldKey: 'targetDate', label: 'Target Date', fieldType: 'date', sortable: true, visible: true, order: 5 },
  {
    fieldKey: 'employmentType', label: 'Employment Type', fieldType: 'picklist', sortable: false, visible: true, order: 6,
    operators: ['eq'],
    picklistOptions: EMPLOYMENT_TYPES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  {
    fieldKey: 'applicationsCount', label: 'Applications', fieldType: 'number', sortable: false, visible: true, order: 7,
    relationship: { targetEntity: 'applications', foreignKey: 'jobOpeningId' },
  },
  {
    fieldKey: 'interviewsCount', label: 'Interviews', fieldType: 'number', sortable: false, visible: true, order: 8,
    relationship: { targetEntity: 'interviews', foreignKey: 'jobOpeningId' },
  },
];

export const jobOpeningLayoutSections: LayoutSection[] = [
  {
    id: 'sec-job-1',
    name: 'Job Opening Information',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'title', label: 'Title', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 250, columnIndex: 0 },
      { fieldKey: 'clientId', label: 'Client', fieldType: 'lookup', required: false, isQuickCreate: true, lookupEntity: 'clients', columnIndex: 1 },
      { fieldKey: 'contactId', label: 'Contact', fieldType: 'lookup', required: false, isQuickCreate: false, lookupEntity: 'contacts', columnIndex: 0 },
      { fieldKey: 'assignedRecruiters', label: 'Assigned Recruiters', fieldType: 'multi_user', required: false, isQuickCreate: true, columnIndex: 1 },
      { fieldKey: 'targetDate', label: 'Target Date', fieldType: 'date', required: false, isQuickCreate: true, columnIndex: 0 },
      {
        fieldKey: 'status', label: 'Status', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 1,
        picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
      {
        fieldKey: 'employmentType', label: 'Employment Type', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 0,
        picklistOptions: EMPLOYMENT_TYPES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
      { fieldKey: 'numberOfPositions', label: 'Number of Positions', fieldType: 'number', required: false, isQuickCreate: false, columnIndex: 1 },
    ],
  },
  {
    id: 'sec-job-2',
    name: 'Description Information',
    columns: 1,
    sortOrder: 2,
    isCollapsible: true,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'jobDescription', label: 'Job Description', fieldType: 'rich_text', required: false, isQuickCreate: false, columnIndex: 0 },
      { fieldKey: 'jobRequirements', label: 'Job Requirements', fieldType: 'rich_text', required: false, isQuickCreate: false, columnIndex: 0 },
    ],
  },
];

export const jobOpeningSearchColumns = ['title', 'department', 'location'];
