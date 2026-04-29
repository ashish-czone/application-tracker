import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { SkillsManager } from '../portals/recruiter/features/candidates/components/SkillsManager';
import { ResumeSection } from '../portals/recruiter/features/candidates/components/ResumeSection';

export const CANDIDATES_UI_CONFIG: EntityUIConfig = {
  entityType: 'candidates',
  presentation: {
    singularName: 'Candidate',
    pluralName: 'Candidates',
    subtitleField: 'currentTitle',
    icon: 'users',
    navGroup: 'recruit',
    navOrder: 1,
  },
  fieldUI: {
    fullName: { label: 'Candidate', cellRenderer: 'AvatarNameCell' },
    // Basic Info
    email: { label: 'Email' },
    firstName: { label: 'First Name' },
    phone: { label: 'Phone' },
    lastName: { label: 'Last Name' },
    website: { label: 'Website' },
    mobile: { label: 'Mobile' },
    secondaryEmail: { label: 'Secondary Email' },
    // Address
    street: { label: 'Street' },
    postalCode: { label: 'Postal Code' },
    city: { label: 'City' },
    state: { label: 'Province' },
    country: { label: 'Country' },
    // Professional
    experienceInYears: { label: 'Experience in Years' },
    highestQualification: { label: 'Highest Qualification' },
    currentTitle: { label: 'Current Job Title' },
    currentCompany: { label: 'Current Employer' },
    noticePeriod: { label: 'Notice Period' },
    salaryExpectationMin: { label: 'Expected Salary (Min)' },
    salaryExpectationMax: { label: 'Expected Salary (Max)' },
    currentSalary: { label: 'Current Salary' },
    currency: { label: 'Currency' },
    skillSet: { label: 'Skill Set' },
    additionalInfo: { label: 'Additional Info' },
    skills: { label: 'Skills' },
    // Social
    linkedinUrl: { label: 'LinkedIn' },
    facebookUrl: { label: 'Facebook' },
    twitterHandle: { label: 'Twitter' },
    // Other
    candidateStatus: { label: 'Candidate Status', cellRenderer: 'StatusBadge' },
    source: { label: 'Source' },
    emailOptOut: { label: 'Email Opt Out' },
    dateOfBirth: { label: 'Date of Birth' },
    gender: { label: 'Gender' },
    nationality: { label: 'Nationality' },
    isWillingToRelocate: { label: 'Willing to Relocate' },
    availableFrom: { label: 'Available From' },
    notes: { label: 'Notes' },
    // Attachments
    resume: { label: 'Resume' },
  },
  formLayout: {
    sections: [
      { name: 'Basic Info', fields: ['email', 'firstName', 'phone', 'lastName', 'website', 'mobile', 'secondaryEmail'] },
      { name: 'Address Information', fields: ['street', 'postalCode', 'city', 'state', 'country'] },
      { name: 'Professional Details', fields: ['experienceInYears', 'highestQualification', 'currentTitle', 'currentCompany', 'noticePeriod', 'salaryExpectationMin', 'salaryExpectationMax', 'currentSalary', 'currency', 'skillSet', 'additionalInfo', 'skills'] },
      { name: 'Social Links', fields: ['linkedinUrl', 'facebookUrl', 'twitterHandle'] },
      { name: 'Other Info', fields: ['candidateStatus', 'source', 'emailOptOut', 'dateOfBirth', 'gender', 'nationality', 'isWillingToRelocate', 'availableFrom', 'notes'] },
      { name: 'Attachments', fields: ['resume'] },
    ],
    quickCreateFields: ['email', 'firstName', 'lastName', 'mobile', 'currentTitle', 'currentCompany', 'source'],
  },
  listColumns: [
    { fieldKey: 'fullName', visible: true, order: 0 },
    { fieldKey: 'currentTitle', visible: true, order: 1 },
    { fieldKey: 'candidateStatus', visible: true, order: 2 },
    { fieldKey: 'source', visible: true, order: 3 },
  ],
  actionUI: {
    edit: { label: 'Edit', icon: 'Pencil' },
    clone: { label: 'Clone', icon: 'Copy' },
    delete: { label: 'Delete', icon: 'Trash2', variant: 'destructive' },
    massUpdate: { label: 'Mass Update', icon: 'PenLine' },
    massDelete: { label: 'Mass Delete', icon: 'Trash2', variant: 'destructive' },
    export: { label: 'Export', icon: 'Download' },
    'apply-to-job': { label: 'Apply to Job', icon: 'Briefcase' },
  },
  detailPlugins: [
    { component: SkillsManager as any, label: 'Skills', order: 1 },
    { component: ResumeSection as any, label: 'Resume', order: 2 },
  ],
};
