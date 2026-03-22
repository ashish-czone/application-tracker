import type { FieldType } from '@packages/eav-attributes';

/**
 * Presentation metadata that can't be derived from the Drizzle schema.
 * Keys must match the camelCase property names in the candidates table.
 */
export const CANDIDATE_FIELD_META: Record<string, {
  label: string;
  section: string;
  sortOrder: number;
  isQuickCreate?: boolean;
  isSystem?: boolean;
  isUnique?: boolean;
  fieldType?: FieldType;
  uiType?: string;
  picklistOptions?: { label: string; value: string }[];
  maxLength?: number;
}> = {
  firstName: { label: 'First Name', section: 'basic', sortOrder: 0, isQuickCreate: true, isSystem: true, maxLength: 100 },
  lastName: { label: 'Last Name', section: 'basic', sortOrder: 1, isQuickCreate: true, isSystem: true, maxLength: 100 },
  email: { label: 'Email', section: 'basic', sortOrder: 2, isQuickCreate: true, isUnique: true, fieldType: 'email', maxLength: 255 },
  phone: { label: 'Phone', section: 'basic', sortOrder: 3, isQuickCreate: true, fieldType: 'phone', maxLength: 20 },
  gender: {
    label: 'Gender', section: 'basic', sortOrder: 4, fieldType: 'picklist',
    picklistOptions: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Other', value: 'other' },
      { label: 'Prefer not to say', value: 'prefer-not-to-say' },
    ],
  },
  dateOfBirth: { label: 'Date of Birth', section: 'basic', sortOrder: 5, fieldType: 'date' },
  nationality: { label: 'Nationality', section: 'basic', sortOrder: 6, maxLength: 100 },
  currentTitle: { label: 'Current Title', section: 'professional', sortOrder: 0, maxLength: 200 },
  currentCompany: { label: 'Current Company', section: 'professional', sortOrder: 1, maxLength: 200 },
  expectedSalary: { label: 'Expected Salary', section: 'professional', sortOrder: 2, fieldType: 'currency' },
  currency: { label: 'Currency', section: 'professional', sortOrder: 3, maxLength: 3 },
  source: {
    label: 'Source', section: 'professional', sortOrder: 4, isQuickCreate: true, fieldType: 'picklist',
    picklistOptions: [
      { label: 'Referral', value: 'referral' },
      { label: 'Job Board', value: 'job-board' },
      { label: 'LinkedIn', value: 'linkedin' },
      { label: 'Direct', value: 'direct' },
      { label: 'Website', value: 'website' },
    ],
  },
  availableFrom: { label: 'Available From', section: 'professional', sortOrder: 5, fieldType: 'date' },
  isWillingToRelocate: { label: 'Willing to Relocate', section: 'professional', sortOrder: 6, fieldType: 'boolean' },
  linkedinUrl: { label: 'LinkedIn URL', section: 'professional', sortOrder: 7, fieldType: 'url', maxLength: 500 },
  highestQualification: {
    label: 'Highest Qualification', section: 'education', sortOrder: 0, fieldType: 'picklist',
    picklistOptions: [
      { label: 'High School', value: 'high-school' },
      { label: 'Bachelors', value: 'bachelors' },
      { label: 'Masters', value: 'masters' },
      { label: 'PhD', value: 'phd' },
      { label: 'Other', value: 'other' },
    ],
  },
  address: { label: 'Street Address', section: 'address', sortOrder: 0, maxLength: 500 },
  city: { label: 'City', section: 'address', sortOrder: 1, maxLength: 100 },
  state: { label: 'State', section: 'address', sortOrder: 2, maxLength: 100 },
  country: { label: 'Country', section: 'address', sortOrder: 3, maxLength: 100 },
  zipCode: { label: 'Zip Code', section: 'address', sortOrder: 4, maxLength: 20 },
  notes: { label: 'Notes', section: 'other', sortOrder: 0, fieldType: 'textarea', maxLength: 5000 },
};

/** Fields to skip — internal/system columns that admins don't interact with */
export const SKIP_FIELDS = ['id', 'deletedAt', 'deletedBy', 'resumeFile', 'createdAt', 'updatedAt', 'createdBy'];

/** Section definitions for the default layout (field keys use camelCase to match Drizzle property names) */
export const CANDIDATE_SECTIONS = [
  { name: 'Basic Info', fields: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'nationality'] },
  { name: 'Professional Details', fields: ['currentTitle', 'currentCompany', 'expectedSalary', 'source', 'availableFrom', 'isWillingToRelocate', 'linkedinUrl'] },
  { name: 'Education', fields: ['highestQualification'] },
  { name: 'Address', fields: ['address', 'city', 'state', 'country', 'zipCode'] },
];
