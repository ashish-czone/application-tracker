import type { MockEntity, ListColumn, LayoutSection, LayoutField } from '../mock-api';

const FIRST_NAMES = [
  'James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Ashley',
  'William', 'Amanda', 'Richard', 'Stephanie', 'Joseph', 'Nicole', 'Thomas', 'Elizabeth',
  'Christopher', 'Megan', 'Daniel', 'Jennifer', 'Matthew', 'Lauren', 'Andrew', 'Rachel',
  'Joshua', 'Samantha', 'Kevin', 'Katherine', 'Brian', 'Olivia',
];

const LAST_NAMES = [
  'Anderson', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis',
  'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright',
  'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson',
  'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips',
];

const STATUSES = ['new', 'in-review', 'qualified', 'unqualified', 'contacted'];
const SOURCES = ['career-page', 'linkedin', 'referral', 'indeed', 'agency'];
const TITLES = ['Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer', 'DevOps Engineer', 'QA Engineer'];
const COMPANIES = ['Acme Corp', 'Tech Solutions', 'Innovate Inc', 'DataFlow', 'CloudBase', 'NetWorks'];

export function generateCandidates(count = 30) {
  return Array.from({ length: count }, (_, i) => ({
    id: `cand-${String(i + 1).padStart(3, '0')}`,
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[i % LAST_NAMES.length],
    fullName: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
    email: `${FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()}.${LAST_NAMES[i % LAST_NAMES.length].toLowerCase()}@example.com`,
    mobile: `+1555${String(1000 + i).padStart(7, '0')}`,
    currentTitle: TITLES[i % TITLES.length],
    currentCompany: COMPANIES[i % COMPANIES.length],
    candidateStatus: STATUSES[i % STATUSES.length],
    source: SOURCES[i % SOURCES.length],
    applicationsCount: i % 5,
    createdAt: new Date(2026, 0, i + 1).toISOString(),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    createdBy: 'user-001',
    createdBy__label: 'John Doe',
  }));
}

export const candidateEntity: MockEntity = {
  entityType: 'candidates',
  singularName: 'Candidate',
  pluralName: 'Candidates',
  slug: 'candidates',
  icon: 'users',
  nameField: 'fullName',
  features: { hasNotes: true, hasAttachments: true, softDelete: true, restore: true },
  relationships: [
    { name: 'applications', type: 'hasMany', targetEntity: 'applications', foreignKey: 'candidateId', label: 'Applications' },
  ],
};

export const candidateListColumns: ListColumn[] = [
  { fieldKey: 'fullName', label: 'Name', fieldType: 'text', sortable: true, visible: true, order: 1 },
  { fieldKey: 'email', label: 'Email', fieldType: 'email', sortable: true, visible: true, order: 2 },
  { fieldKey: 'mobile', label: 'Mobile', fieldType: 'phone', sortable: false, visible: true, order: 3 },
  { fieldKey: 'currentTitle', label: 'Current Title', fieldType: 'text', sortable: true, visible: true, order: 4 },
  { fieldKey: 'currentCompany', label: 'Current Company', fieldType: 'text', sortable: false, visible: true, order: 5 },
  {
    fieldKey: 'candidateStatus', label: 'Status', fieldType: 'picklist', sortable: true, visible: true, order: 6,
    operators: ['eq', 'neq'],
    picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  {
    fieldKey: 'source', label: 'Source', fieldType: 'picklist', sortable: false, visible: true, order: 7,
    operators: ['eq', 'neq'],
    picklistOptions: SOURCES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
  },
  {
    fieldKey: 'applicationsCount', label: 'Applications', fieldType: 'number', sortable: false, visible: true, order: 8,
    relationship: { targetEntity: 'applications', foreignKey: 'candidateId' },
  },
];

export const candidateLayoutSections: LayoutSection[] = [
  {
    id: 'sec-cand-1',
    name: 'Candidate Information',
    columns: 2,
    sortOrder: 1,
    isCollapsible: false,
    isTabular: false,
    tabularMaxRows: null,
    fields: [
      { fieldKey: 'firstName', label: 'First Name', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 125, columnIndex: 0 },
      { fieldKey: 'lastName', label: 'Last Name', fieldType: 'text', required: true, isQuickCreate: true, maxLength: 125, columnIndex: 1 },
      { fieldKey: 'email', label: 'Email', fieldType: 'email', required: true, isQuickCreate: true, columnIndex: 0 },
      { fieldKey: 'mobile', label: 'Mobile', fieldType: 'phone', required: false, isQuickCreate: true, columnIndex: 1 },
      { fieldKey: 'currentTitle', label: 'Current Title', fieldType: 'text', required: false, isQuickCreate: false, columnIndex: 0 },
      { fieldKey: 'currentCompany', label: 'Current Company', fieldType: 'text', required: false, isQuickCreate: false, columnIndex: 1 },
      {
        fieldKey: 'candidateStatus', label: 'Status', fieldType: 'picklist', required: false, isQuickCreate: true, columnIndex: 0,
        picklistOptions: STATUSES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
      {
        fieldKey: 'source', label: 'Source', fieldType: 'picklist', required: false, isQuickCreate: false, columnIndex: 1,
        picklistOptions: SOURCES.map((s) => ({ label: s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s })),
      },
    ],
  },
];

export const candidateSearchColumns = ['firstName', 'lastName', 'email'];
