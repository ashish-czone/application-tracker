import type { LookupSearchFn, LookupResolveFn } from '@packages/entity-engine-ui';

/**
 * Reusable picker overrides for any field whose stored value is a
 * `recruit_clients.id` but whose picker should search the canonical identity
 * registry (`directory.companies`) and bridge a picked company to a
 * recruit_client wrapper at submit time.
 *
 * Used by contacts.clientId, job_openings.clientId, interviews.clientId.
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
  const result = await apiFn.post<FindOrCreateForCompanyResult>(
    '/clients/find-or-create-for-company',
    { companyId: option.value },
  );
  return { label: option.label, value: result.id };
};
