export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  expectedSalary: number | null;
  currency: string | null;
  highestQualification: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  isWillingToRelocate: boolean | null;
  availableFrom: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  resumeFile: { key: string; originalName: string; mimeType: string; size: number; uploadedAt: string } | null;
  skills: { id: string; name: string; slug: string }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCandidateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: string;
  currentCompany?: string;
  currentTitle?: string;
  expectedSalary?: number;
  currency?: string;
  highestQualification?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isWillingToRelocate?: boolean;
  availableFrom?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface UpdateCandidateRequest extends Partial<CreateCandidateRequest> {}

export interface ListCandidatesParams {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
  country?: string;
  qualification?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export const SOURCE_OPTIONS = [
  { label: 'Referral', value: 'referral' },
  { label: 'Job Board', value: 'job-board' },
  { label: 'Website', value: 'website' },
  { label: 'Direct', value: 'direct' },
  { label: 'LinkedIn', value: 'linkedin' },
] as const;

export const QUALIFICATION_OPTIONS = [
  { label: 'High School', value: 'high-school' },
  { label: 'Bachelors', value: 'bachelors' },
  { label: 'Masters', value: 'masters' },
  { label: 'PhD', value: 'phd' },
  { label: 'Other', value: 'other' },
] as const;

export const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
] as const;
