import type { EntityConfig } from '@packages/entity-engine';
import { jobOpenings } from './schema/job-openings';

export const JOB_OPENINGS_CONFIG: EntityConfig = {
  entityType: 'job_openings',
  singularName: 'Job Opening',
  pluralName: 'Job Openings',
  slug: 'job-openings',

  table: jobOpenings,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],

  searchColumns: [jobOpenings.title, jobOpenings.department, jobOpenings.location],

  defaultSort: 'createdAt',
  sortableColumns: {
    title: jobOpenings.title,
    department: jobOpenings.department,
    createdAt: jobOpenings.createdAt,
    status: jobOpenings.status,
  },

  fieldMeta: {
    // Job Opening Information
    title: { label: 'Posting Title', section: 'basic', sortOrder: 0, isQuickCreate: true, isSystem: true, maxLength: 250 },
    clientId: {
      label: 'Client Name', section: 'basic', sortOrder: 1, isQuickCreate: true,
      fieldType: 'lookup', lookupEntity: 'clients', lookupLabelField: 'clientName',
      lookupSearchFields: ['clientName'],
    },
    contactId: {
      label: 'Contact Name', section: 'basic', sortOrder: 2,
      fieldType: 'lookup', lookupEntity: 'contacts', lookupLabelField: 'lastName',
      lookupSearchFields: ['firstName', 'lastName', 'email'],
    },
    dateOpened: { label: 'Date Opened', section: 'basic', sortOrder: 3, fieldType: 'date' },
    targetDate: { label: 'Target Date', section: 'basic', sortOrder: 4, isQuickCreate: true, fieldType: 'date' },
    employmentType: {
      label: 'Job Type', section: 'basic', sortOrder: 5, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Full Time', value: 'full-time' },
        { label: 'Part Time', value: 'part-time' },
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
      label: 'Job Opening Status', section: 'basic', sortOrder: 6, fieldType: 'picklist', isSystem: true,
      picklistOptions: [
        { label: 'In-progress', value: 'in-progress' },
        { label: 'Waiting for Approval', value: 'waiting-for-approval' },
        { label: 'On-Hold', value: 'on-hold' },
        { label: 'Filled', value: 'filled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Declined', value: 'declined' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    experience: {
      label: 'Work Experience', section: 'basic', sortOrder: 7, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Fresher', value: 'fresher' },
        { label: '0-1 year', value: '0-1-year' },
        { label: '1-3 years', value: '1-3-years' },
        { label: '4-5 years', value: '4-5-years' },
        { label: '5+ years', value: '5-plus-years' },
      ],
    },
    industry: {
      label: 'Industry', section: 'basic', sortOrder: 8, fieldType: 'picklist',
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
      ],
    },
    requirements: { label: 'Required Skills', section: 'basic', sortOrder: 9, isQuickCreate: true, fieldType: 'textarea', maxLength: 6000 },
    salary: { label: 'Salary', section: 'basic', sortOrder: 10 },
    // Address Information
    location: { label: 'City', section: 'address', sortOrder: 0, maxLength: 120 },
    department: { label: 'Department', section: 'address', sortOrder: 1, maxLength: 120 },
    country: { label: 'Country', section: 'address', sortOrder: 2 },
    postalCode: { label: 'Postal Code', section: 'address', sortOrder: 3, maxLength: 30 },
    remoteJob: { label: 'Remote Job', section: 'address', sortOrder: 4, fieldType: 'boolean' },
    // Forecast Details
    numberOfPositions: { label: 'Number of Positions', section: 'forecast', sortOrder: 0, fieldType: 'number' },
    revenuePerPosition: { label: 'Revenue per Position', section: 'forecast', sortOrder: 1, fieldType: 'currency' },
    expectedRevenue: { label: 'Expected Revenue', section: 'forecast', sortOrder: 2, fieldType: 'currency' },
    actualRevenue: { label: 'Actual Revenue', section: 'forecast', sortOrder: 3, fieldType: 'currency' },
    missedRevenue: { label: 'Missed Revenue', section: 'forecast', sortOrder: 4, fieldType: 'currency' },
    // Legacy fields
    description: { label: 'Description', section: 'details', sortOrder: 0, fieldType: 'textarea', maxLength: 10000 },
    salaryMin: { label: 'Salary Min', section: 'details', sortOrder: 1, fieldType: 'currency' },
    salaryMax: { label: 'Salary Max', section: 'details', sortOrder: 2, fieldType: 'currency' },
    currency: { label: 'Currency', section: 'details', sortOrder: 3, maxLength: 3 },
    publishedAt: { label: 'Published Date', section: 'details', sortOrder: 4, fieldType: 'date' },
    closingDate: { label: 'Closing Date', section: 'details', sortOrder: 5, fieldType: 'date' },
  },

  sections: [
    { name: 'Job Opening Information', fields: ['title', 'clientId', 'contactId', 'dateOpened', 'targetDate', 'employmentType', 'status', 'experience', 'industry', 'requirements', 'salary'] },
    { name: 'Address Information', fields: ['location', 'department', 'country', 'postalCode', 'remoteJob'] },
    { name: 'Forecast Details', fields: ['numberOfPositions', 'revenuePerPosition', 'expectedRevenue', 'actualRevenue', 'missedRevenue'] },
    { name: 'Details', fields: ['description', 'salaryMin', 'salaryMax', 'currency', 'publishedAt', 'closingDate'] },
  ],

  features: { softDelete: true, restore: true },

  lookup: {
    labelField: 'title',
    searchFields: ['title', 'department'],
  },

  relationships: [
    { name: 'applications', type: 'hasMany', targetEntity: 'applications', foreignKey: 'jobOpeningId', label: 'Applications', displayFields: ['status', 'stage', 'createdAt'] },
    { name: 'interviews', type: 'hasMany', targetEntity: 'interviews', foreignKey: 'jobOpeningId', label: 'Interviews', displayFields: ['interviewName', 'interviewFrom', 'status'] },
  ],

  recipientFields: { createdBy: { label: 'Created By' } },

  ui: {
    icon: 'briefcase',
    nameField: 'title',
    subtitleField: 'department',
    navGroup: 'recruit',
    navOrder: 1,
  },
};
