/** Candidate entity — flat structure with base + EAV fields merged */
export interface Candidate extends Record<string, unknown> {
  id: string;
  resumeFile: { key: string; originalName: string; mimeType: string; size: number; uploadedAt: string } | null;
  skills: { id: string; name: string; slug: string }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type CreateCandidateRequest = Record<string, unknown>;
export type UpdateCandidateRequest = Record<string, unknown>;

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

/** Kept for the list page source filter — will be replaced by layout-driven options later */
export const SOURCE_OPTIONS = [
  { label: 'Referral', value: 'referral' },
  { label: 'Job Board', value: 'job-board' },
  { label: 'Website', value: 'website' },
  { label: 'Direct', value: 'direct' },
  { label: 'LinkedIn', value: 'linkedin' },
] as const;
