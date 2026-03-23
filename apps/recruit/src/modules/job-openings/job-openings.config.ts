import { eq } from 'drizzle-orm';
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
    title: { label: 'Job Title', section: 'basic', sortOrder: 0, isQuickCreate: true, isSystem: true, maxLength: 300 },
    department: { label: 'Department', section: 'basic', sortOrder: 1, isQuickCreate: true, maxLength: 200 },
    location: { label: 'Location', section: 'basic', sortOrder: 2, isQuickCreate: true, maxLength: 200 },
    employmentType: {
      label: 'Employment Type', section: 'basic', sortOrder: 3, isQuickCreate: true, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Full-time', value: 'full-time' },
        { label: 'Part-time', value: 'part-time' },
        { label: 'Contract', value: 'contract' },
        { label: 'Internship', value: 'internship' },
        { label: 'Freelance', value: 'freelance' },
      ],
    },
    experience: {
      label: 'Experience Level', section: 'basic', sortOrder: 4, fieldType: 'picklist',
      picklistOptions: [
        { label: 'Entry Level', value: 'entry' },
        { label: 'Mid Level', value: 'mid' },
        { label: 'Senior', value: 'senior' },
        { label: 'Lead', value: 'lead' },
        { label: 'Executive', value: 'executive' },
      ],
    },
    numberOfPositions: { label: 'Positions', section: 'basic', sortOrder: 5, fieldType: 'number' },
    salaryMin: { label: 'Salary Min', section: 'compensation', sortOrder: 0, fieldType: 'currency' },
    salaryMax: { label: 'Salary Max', section: 'compensation', sortOrder: 1, fieldType: 'currency' },
    currency: { label: 'Currency', section: 'compensation', sortOrder: 2, maxLength: 3 },
    description: { label: 'Description', section: 'details', sortOrder: 0, fieldType: 'textarea', maxLength: 10000 },
    requirements: { label: 'Requirements', section: 'details', sortOrder: 1, fieldType: 'textarea', maxLength: 10000 },
    status: {
      label: 'Status', section: 'status', sortOrder: 0, fieldType: 'picklist', isSystem: true,
      picklistOptions: [
        { label: 'Draft', value: 'draft' },
        { label: 'Open', value: 'open' },
        { label: 'On Hold', value: 'on-hold' },
        { label: 'Closed', value: 'closed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    publishedAt: { label: 'Published Date', section: 'status', sortOrder: 1, fieldType: 'date' },
    closingDate: { label: 'Closing Date', section: 'status', sortOrder: 2, fieldType: 'date' },
  },

  sections: [
    { name: 'Basic Info', fields: ['title', 'department', 'location', 'employmentType', 'experience', 'numberOfPositions'] },
    { name: 'Compensation', fields: ['salaryMin', 'salaryMax', 'currency'] },
    { name: 'Details', fields: ['description', 'requirements'] },
    { name: 'Status', fields: ['status', 'publishedAt', 'closingDate'] },
  ],

  features: {
    softDelete: true,
    restore: true,
  },

  lookup: {
    labelField: 'title',
    searchFields: ['title', 'department'],
  },

  relationships: [
    {
      name: 'applications',
      type: 'hasMany',
      targetEntity: 'applications',
      foreignKey: 'jobOpeningId',
      label: 'Applications',
      displayFields: ['status', 'stage', 'createdAt'],
    },
  ],

  recipientFields: {
    createdBy: { label: 'Created By (recruiter)' },
  },

  ui: {
    icon: 'briefcase',
    nameField: 'title',
    subtitleField: 'department',
    navGroup: 'recruit',
    navOrder: 2,
  },

  hooks: {
    buildListFilters: (query) => {
      const filters: any[] = [];
      if (query.status) filters.push(eq(jobOpenings.status, query.status as string));
      if (query.department) filters.push(eq(jobOpenings.department, query.department as string));
      if (query.employmentType) filters.push(eq(jobOpenings.employmentType, query.employmentType as string));
      return filters;
    },
  },
};
