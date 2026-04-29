import { eq } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import { jobOpenings } from './schema/job-openings';

export const JOB_OPENINGS_CONFIG: EntityConfig = {
  entityType: 'job_openings',
  singularName: 'Job Opening',
  pluralName: 'Job Openings',
  slug: 'job-openings',

  table: jobOpenings,
  customFields: 'eav',
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchFields: ['title', 'department', 'location'],

  defaultSort: 'createdAt',
  sortableFields: ['title', 'department', 'createdAt', 'status'],

  fieldMeta: {
    // ── Job Opening Information ──────────────────────────────────────────
    title: { label: 'Posting Title', section: 'jobOpeningInfo', sortOrder: 0, isQuickCreate: true, isSystem: true, maxLength: 250 },
    clientId: {
      label: 'Client Name', section: 'jobOpeningInfo', sortOrder: 1, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'clients', lookupLabelField: 'clientName',
      lookupSearchFields: ['clientName'],
    },
    contactId: {
      label: 'Contact Name', section: 'jobOpeningInfo', sortOrder: 2,
      fieldType: 'lookup', lookupEntity: 'contacts', lookupLabelField: 'lastName',
      lookupSearchFields: ['firstName', 'lastName', 'email'],
    },
    hiringManager: {
      label: 'Hiring Manager', section: 'jobOpeningInfo', sortOrder: 3,
      fieldType: 'user',
    },
    accountManager: {
      label: 'Account Manager', section: 'jobOpeningInfo', sortOrder: 4,
      fieldType: 'user',
    },
    assignedRecruiters: {
      label: 'Assigned Recruiter(s)', section: 'jobOpeningInfo', sortOrder: 5, isQuickCreate: true,
      fieldType: 'multi_user',
    },
    dateOpened: { label: 'Date Opened', section: 'jobOpeningInfo', sortOrder: 6, fieldType: 'date' },
    targetDate: { label: 'Target Date', section: 'jobOpeningInfo', sortOrder: 7, isQuickCreate: true, fieldType: 'date' },
    employmentType: {
      label: 'Job Type', section: 'jobOpeningInfo', sortOrder: 8, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Full time', value: 'full-time' },
        { label: 'Part time', value: 'part-time' },
        { label: 'Temporary', value: 'temporary' },
        { label: 'Contract', value: 'contract' },
        { label: 'Any', value: 'any' },
        { label: 'Permanent', value: 'permanent' },
        { label: 'Training', value: 'training' },
        { label: 'Volunteer', value: 'volunteer' },
        { label: 'Seasonal', value: 'seasonal' },
        { label: 'Freelance', value: 'freelance' },
      ],
    },
    status: {
      label: 'Job Opening Status', section: 'jobOpeningInfo', sortOrder: 9, fieldType: 'picklist', cellRenderer: 'StatusBadge',
      picklistOptions: [
        { label: 'In-progress', value: 'in-progress' },
        { label: 'Waiting for Approval', value: 'waiting-for-approval' },
        { label: 'On-Hold', value: 'on-hold' },
        { label: 'Filled', value: 'filled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Declined', value: 'declined' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Submitted by Client', value: 'submitted-by-client' },
      ],
    },
    experience: {
      label: 'Work Experience', section: 'jobOpeningInfo', sortOrder: 10, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Fresher', value: 'fresher' },
        { label: '0-1 year', value: '0-1-year' },
        { label: '1-3 years', value: '1-3-years' },
        { label: '4-5 years', value: '4-5-years' },
        { label: '5+ years', value: '5-plus-years' },
      ],
    },
    industry: {
      label: 'Industry', section: 'jobOpeningInfo', sortOrder: 11, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Communications', value: 'communications' },
        { label: 'Technology', value: 'technology' },
        { label: 'Government/Military', value: 'government-military' },
        { label: 'Manufacturing', value: 'manufacturing' },
        { label: 'Financial Services', value: 'financial-services' },
        { label: 'IT Services', value: 'it-services' },
        { label: 'Education', value: 'education' },
        { label: 'Pharma', value: 'pharma' },
        { label: 'Real Estate', value: 'real-estate' },
        { label: 'Consulting', value: 'consulting' },
        { label: 'Health Care', value: 'health-care' },
        { label: 'Administration', value: 'administration' },
        { label: 'Advertising', value: 'advertising' },
        { label: 'Agriculture', value: 'agriculture' },
        { label: 'Banking', value: 'banking' },
        { label: 'Biotechnology', value: 'biotechnology' },
        { label: 'Construction', value: 'construction' },
        { label: 'Defence', value: 'defence' },
        { label: 'Electronics', value: 'electronics' },
        { label: 'Engineering', value: 'engineering' },
        { label: 'Entertainment', value: 'entertainment' },
        { label: 'Hospitality', value: 'hospitality' },
        { label: 'Insurance', value: 'insurance' },
        { label: 'Legal', value: 'legal' },
        { label: 'Logistics', value: 'logistics' },
        { label: 'Media', value: 'media' },
        { label: 'Retail', value: 'retail' },
        { label: 'Telecommunications', value: 'telecommunications' },
        { label: 'Transportation', value: 'transportation' },
        { label: 'Other', value: 'other' },
      ],
    },
    jobFunction: {
      label: 'Job Function', section: 'jobOpeningInfo', sortOrder: 12, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Engineering', value: 'engineering' },
        { label: 'Sales', value: 'sales' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Operations', value: 'operations' },
        { label: 'Product', value: 'product' },
        { label: 'Design', value: 'design' },
        { label: 'Finance', value: 'finance' },
        { label: 'Human Resources', value: 'human-resources' },
        { label: 'Legal', value: 'legal' },
        { label: 'Customer Support', value: 'customer-support' },
        { label: 'Data & Analytics', value: 'data-analytics' },
        { label: 'IT & Infrastructure', value: 'it-infrastructure' },
        { label: 'Administration', value: 'administration' },
        { label: 'Other', value: 'other' },
      ],
    },
    confidential: { label: 'Confidential', section: 'jobOpeningInfo', sortOrder: 13, fieldType: 'boolean' },
    requiredSkills: {
      label: 'Required Skills', section: 'jobOpeningInfo', sortOrder: 14, isQuickCreate: true,
      fieldType: 'tags', tagGroupSlug: 'recruit-skills',
    },
    salaryMin: { label: 'Salary Min', section: 'compensation', sortOrder: 0, fieldType: 'currency' },
    salaryMax: { label: 'Salary Max', section: 'compensation', sortOrder: 1, fieldType: 'currency' },
    currency: { label: 'Currency', section: 'compensation', sortOrder: 2, maxLength: 3 },

    // ── Address Information ──────────────────────────────────────────────
    department: { label: 'Department', section: 'address', sortOrder: 0, fieldType: 'category', categoryGroupSlug: 'departments' },
    location: { label: 'Office', section: 'address', sortOrder: 1, fieldType: 'category', categoryGroupSlug: 'offices' },
    country: { label: 'Country', section: 'address', sortOrder: 2, fieldType: 'category', categoryGroupSlug: 'countries' },
    postalCode: { label: 'Postal Code', section: 'address', sortOrder: 3, maxLength: 30 },
    remoteJob: { label: 'Remote Job', section: 'address', sortOrder: 4, fieldType: 'boolean' },

    // ── Forecast Details ─────────────────────────────────────────────────
    numberOfPositions: { label: 'Number of Positions', section: 'forecast', sortOrder: 0, fieldType: 'number' },
    revenuePerPosition: { label: 'Revenue per Position', section: 'forecast', sortOrder: 1, fieldType: 'currency' },

    // ── Description Information ──────────────────────────────────────────
    jobDescription: { label: 'Job Description', section: 'description', sortOrder: 0, fieldType: 'rich_text', maxLength: 32000 },
    jobRequirements: { label: 'Requirements', section: 'description', sortOrder: 1, fieldType: 'rich_text', maxLength: 32000 },
    benefits: { label: 'Benefits', section: 'description', sortOrder: 2, fieldType: 'rich_text', maxLength: 32000 },

    // ── Attachment Information ────────────────────────────────────────────
    jobSummary: {
      label: 'Job Summary', section: 'attachments', sortOrder: 0, fieldType: 'file',
      accept: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      maxFileSize: 10485760,
    },
    otherAttachments: {
      label: 'Others', section: 'attachments', sortOrder: 1, fieldType: 'file',
      maxFileSize: 10485760,
    },
  },

  sections: [
    {
      name: 'Job Opening Information', columns: 2,
      fields: ['title', 'clientId', 'contactId', 'hiringManager', 'accountManager', 'assignedRecruiters', 'dateOpened', 'targetDate', 'employmentType', 'status', 'experience', 'industry', 'jobFunction', 'confidential', 'requiredSkills'],
    },
    {
      name: 'Address Information', columns: 2,
      fields: ['department', 'location', 'country', 'postalCode', 'remoteJob'],
    },
    {
      name: 'Compensation', columns: 2,
      fields: ['salaryMin', 'salaryMax', 'currency'],
    },
    {
      name: 'Forecast Details', columns: 2,
      fields: ['numberOfPositions', 'revenuePerPosition'],
    },
    {
      name: 'Description Information', columns: 1,
      fields: ['jobDescription', 'jobRequirements', 'benefits'],
    },
    {
      name: 'Attachment Information', columns: 1,
      fields: ['jobSummary', 'otherAttachments'],
    },
  ],

  listFields: ['title', 'clientId', 'status', 'targetDate', 'applicationsCount'],

  lookup: {
    labelField: 'title',
    searchFields: ['title', 'department'],
  },

  relationships: [
    { name: 'applications', type: 'hasMany', targetEntity: 'applications', foreignKey: 'jobOpeningId', label: 'Applications', displayFields: ['stage', 'createdAt'] },
    { name: 'interviews', type: 'hasMany', targetEntity: 'interviews', foreignKey: 'jobOpeningId', label: 'Interviews', displayFields: ['interviewName', 'interviewFrom', 'status'] },
  ],

  actions: {
    row: [
      { key: 'edit', label: 'Edit', icon: 'Pencil', permission: 'update' },
      { key: 'clone', label: 'Clone', icon: 'Copy', permission: 'create' },
      { key: 'delete', label: 'Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
    ],
    bulk: [
      { key: 'massUpdate', label: 'Mass Update', icon: 'PenLine', permission: 'update' },
      { key: 'massDelete', label: 'Mass Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
      { key: 'export', label: 'Export', icon: 'Download', permission: 'read' },
    ],
    detail: [
      {
        key: 'apply-candidate',
        label: 'Apply Candidate',
        icon: 'UserPlus',
        permission: 'create',
        picker: {
          entityType: 'candidates',
          selectionMode: 'multiple',
          submitUrl: '/applications',
          fieldMapping: { jobOpeningId: ':id', candidateId: ':selectedId' },
          existingCheck: {
            listUrl: '/applications',
            filterField: 'jobOpeningId',
            matchField: 'candidateId',
            label: 'Already applied',
            disableSelection: true,
          },
        },
      },
      { key: 'clone', label: 'Clone', icon: 'Copy', permission: 'create' },
      { key: 'delete', label: 'Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
    ],
  },

  dataAccess: {
    anchors: { creator: 'createdBy' },
    scopes: [
      {
        key: 'hiring-manager',
        label: 'Where I am Hiring Manager',
        resolve: async (userId) => eq(jobOpenings.hiringManager, userId),
      },
    ],
  },

  recipientFields: {
    createdBy: { label: 'Created By' },
    hiringManager: { label: 'Hiring Manager' },
  },

  nameField: 'title',
  subtitleField: 'department',
};
