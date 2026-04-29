import type { LookupSearchFn, LookupResolveFn } from '@packages/entity-engine-ui';

/**
 * Reusable picker overrides for any field whose stored value is a
 * `companies.id` (post FK repoint, all child tables FK companies directly).
 * The picker searches the canonical identity registry (`directory.companies`).
 *
 * The resolve step calls `/clients/find-or-create-for-company` to stamp
 * `companies.recruit_became_client_at` (so the picked company is marked as a
 * recruit client) and returns the company.id as the stored value.
 *
 * Used by contacts.companyId, job_openings.companyId, interviews.companyId.
 */

interface CompanyRow {
  id: string;
  name: string;
}

interface FindOrCreateForCompanyResult {
  id: string;
  created: boolean;
}

export const searchCompaniesForClientPicker: LookupSearchFn = async (apiFn, query) => {
  if (!query || query.length === 0) return [];
  const rows = await apiFn.get<CompanyRow[]>(
    `/admin/directory/companies/search?q=${encodeURIComponent(query)}`,
  );
  return rows.map(r => ({ label: r.name, value: r.id }));
};

export const resolveCompanyToClient: LookupResolveFn = async (apiFn, option) => {
  // Stamp companies.recruit_became_client_at so the picked company shows up
  // as a recruit client. The endpoint returns { id: companyId, created },
  // so the stored value remains the company.id (which is what FK columns expect).
  const result = await apiFn.post<FindOrCreateForCompanyResult>(
    '/clients/find-or-create-for-company',
    { companyId: option.value },
  );
  return { label: option.label, value: result.id };
};
