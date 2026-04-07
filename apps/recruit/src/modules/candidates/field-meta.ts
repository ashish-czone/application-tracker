import type { FieldMeta } from '@packages/entity-engine';

/**
 * Presentation metadata matching Zoho Recruit Candidates standard fields.
 * Keys must match the camelCase property names in the candidates table.
 */
export const CANDIDATE_FIELD_META: Record<string, FieldMeta> = {
  // Basic Info
  email: { label: 'Email', section: 'basic', sortOrder: 0, isQuickCreate: true, isUnique: true, fieldType: 'email', maxLength: 255 },
  firstName: { label: 'First Name', section: 'basic', sortOrder: 1, isQuickCreate: true, isSystem: true, maxLength: 125, cellRenderer: 'CandidateNameCell' },
  phone: { label: 'Phone', section: 'basic', sortOrder: 2, fieldType: 'phone' },
  lastName: { label: 'Last Name', section: 'basic', sortOrder: 3, isQuickCreate: true, isSystem: true, maxLength: 125 },
  website: { label: 'Website', section: 'basic', sortOrder: 4, fieldType: 'url' },
  mobile: { label: 'Mobile', section: 'basic', sortOrder: 5, isQuickCreate: true, fieldType: 'phone' },
  secondaryEmail: { label: 'Secondary Email', section: 'basic', sortOrder: 6, fieldType: 'email' },
  fax: { label: 'Fax', section: 'basic', sortOrder: 7 },
  // Address
  street: { label: 'Street', section: 'address', sortOrder: 0, maxLength: 250 },
  postalCode: { label: 'Postal Code', section: 'address', sortOrder: 1, maxLength: 30 },
  city: { label: 'City', section: 'address', sortOrder: 2 },
  state: { label: 'Province', section: 'address', sortOrder: 3 },
  country: { label: 'Country', section: 'address', sortOrder: 4 },
  // Professional Details
  experienceInYears: { label: 'Experience in Years', section: 'professional', sortOrder: 0, fieldType: 'decimal' },
  highestQualification: {
    label: 'Highest Qualification', section: 'professional', sortOrder: 1, fieldType: 'picklist',
    picklistOptions: [
      { label: 'High School', value: 'high-school' },
      { label: 'Associate Degree', value: 'associate' },
      { label: 'Bachelor\'s Degree', value: 'bachelors' },
      { label: 'Master\'s Degree', value: 'masters' },
      { label: 'Doctorate / PhD', value: 'doctorate' },
      { label: 'Diploma', value: 'diploma' },
      { label: 'Professional Certification', value: 'professional-cert' },
      { label: 'Other', value: 'other' },
    ],
  },
  currentTitle: {
    label: 'Current Job Title', section: 'professional', sortOrder: 2, isQuickCreate: true, maxLength: 200,
  },
  currentCompany: { label: 'Current Employer', section: 'professional', sortOrder: 3, isQuickCreate: true, maxLength: 100 },
  noticePeriod: {
    label: 'Notice Period', section: 'professional', sortOrder: 4, fieldType: 'picklist',
    picklistOptions: [
      { label: 'Immediate', value: 'immediate' },
      { label: '15 Days', value: '15-days' },
      { label: '30 Days', value: '30-days' },
      { label: '60 Days', value: '60-days' },
      { label: '90 Days', value: '90-days' },
      { label: '90+ Days', value: '90-plus-days' },
    ],
  },
  salaryExpectationMin: { label: 'Expected Salary (Min)', section: 'professional', sortOrder: 5, fieldType: 'currency' },
  salaryExpectationMax: { label: 'Expected Salary (Max)', section: 'professional', sortOrder: 6, fieldType: 'currency' },
  currentSalary: { label: 'Current Salary', section: 'professional', sortOrder: 7, fieldType: 'currency' },
  currency: { label: 'Currency', section: 'professional', sortOrder: 8, maxLength: 3 },
  expectedSalary: { label: 'Expected Salary (Legacy)', section: 'professional', sortOrder: 9, fieldType: 'currency', excludeFromList: true },
  skillSet: { label: 'Skill Set', section: 'professional', sortOrder: 10, fieldType: 'textarea', maxLength: 6000 },
  additionalInfo: { label: 'Additional Info', section: 'professional', sortOrder: 11, fieldType: 'textarea', maxLength: 6000 },
  skypeId: { label: 'Skype ID', section: 'professional', sortOrder: 12 },
  // Social Links
  linkedinUrl: { label: 'LinkedIn', section: 'social', sortOrder: 0, fieldType: 'url' },
  facebookUrl: { label: 'Facebook', section: 'social', sortOrder: 1, fieldType: 'url' },
  twitterHandle: { label: 'Twitter', section: 'social', sortOrder: 2, maxLength: 50 },
  // Other Info
  candidateStatus: {
    label: 'Candidate Status', section: 'other', sortOrder: 0, fieldType: 'picklist', cellRenderer: 'StatusBadge',
    picklistOptions: [
      { label: 'New', value: 'new' },
      { label: 'Contacted', value: 'contacted' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'Unqualified', value: 'unqualified' },
      { label: 'In Process', value: 'in-process' },
      { label: 'On Hold', value: 'on-hold' },
      { label: 'Hired', value: 'hired' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Blacklisted', value: 'blacklisted' },
    ],
  },
  source: {
    label: 'Source', section: 'other', sortOrder: 1, isQuickCreate: true, fieldType: 'picklist',
    picklistOptions: [
      { label: 'Added by User', value: 'added-by-user' },
      { label: 'Advertisement', value: 'advertisement' },
      { label: 'API', value: 'api' },
      { label: 'Career Site', value: 'career-site' },
      { label: 'Cold Call', value: 'cold-call' },
      { label: 'Employee Referral', value: 'employee-referral' },
      { label: 'External Referral', value: 'external-referral' },
      { label: 'Import', value: 'import' },
      { label: 'Partner', value: 'partner' },
      { label: 'Vendor', value: 'vendor' },
    ],
  },
  emailOptOut: { label: 'Email Opt Out', section: 'other', sortOrder: 2, fieldType: 'boolean' },
  // Legacy fields (kept from original schema)
  dateOfBirth: { label: 'Date of Birth', section: 'other', sortOrder: 3, fieldType: 'date' },
  gender: {
    label: 'Gender', section: 'other', sortOrder: 4, fieldType: 'picklist',
    picklistOptions: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Other', value: 'other' },
      { label: 'Prefer not to say', value: 'prefer-not-to-say' },
    ],
  },
  nationality: { label: 'Nationality', section: 'other', sortOrder: 5 },
  isWillingToRelocate: { label: 'Willing to Relocate', section: 'other', sortOrder: 6, fieldType: 'boolean' },
  availableFrom: { label: 'Available From', section: 'other', sortOrder: 7, fieldType: 'date' },
  notes: { label: 'Notes', section: 'other', sortOrder: 8, fieldType: 'textarea', maxLength: 5000 },
  // Relational fields (tags, files)
  skills: {
    label: 'Skills', section: 'professional', sortOrder: 13, fieldType: 'tags',
    tagGroupSlug: 'recruit-skills',
  },
  resume: {
    label: 'Resume', section: 'attachments', sortOrder: 0, fieldType: 'file',
    accept: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxFileSize: 10485760,
  },
};

/** Fields to skip — internal/system columns that admins don't interact with */
export const SKIP_FIELDS = ['id', 'deletedAt', 'deletedBy', 'resumeFile', 'createdAt', 'updatedAt', 'createdBy'];

/** Section definitions matching Zoho Recruit layout */
export const CANDIDATE_SECTIONS = [
  { name: 'Basic Info', fields: ['email', 'firstName', 'phone', 'lastName', 'website', 'mobile', 'secondaryEmail', 'fax'] },
  { name: 'Address Information', fields: ['street', 'postalCode', 'city', 'state', 'country'] },
  { name: 'Professional Details', fields: ['experienceInYears', 'highestQualification', 'currentTitle', 'currentCompany', 'noticePeriod', 'salaryExpectationMin', 'salaryExpectationMax', 'currentSalary', 'currency', 'skillSet', 'additionalInfo', 'skypeId', 'skills'] },
  { name: 'Social Links', fields: ['linkedinUrl', 'facebookUrl', 'twitterHandle'] },
  { name: 'Other Info', fields: ['candidateStatus', 'source', 'emailOptOut', 'dateOfBirth', 'gender', 'nationality', 'isWillingToRelocate', 'availableFrom', 'notes'] },
  { name: 'Attachments', fields: ['resume'] },
];
