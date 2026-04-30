import type { LookupSearchFn, LookupResolveFn } from '@packages/entity-engine-ui';

/**
 * Reusable picker overrides for any field whose stored value is a directory
 * client id (post FK repoint, all child tables FK the directory client row
 * directly). The picker searches the canonical identity registry
 * (`/admin/directory/clients/search`).
 *
 * The resolve step calls `/clients/find-or-create-for-client` to stamp
 * `recruit_became_client_at` (so the picked client is marked as a recruit
 * client) and returns the client id as the stored value.
 *
 * Used by contacts.clientId, job_openings.clientId, interviews.clientId.
 */

interface ClientRow {
  id: string;
  name: string;
}

interface FindOrCreateForClientResult {
  id: string;
  created: boolean;
}

export const searchClientsForPicker: LookupSearchFn = async (apiFn, query) => {
  if (!query || query.length === 0) return [];
  const rows = await apiFn.get<ClientRow[]>(
    `/admin/directory/clients/search?q=${encodeURIComponent(query)}`,
  );
  return rows.map(r => ({ label: r.name, value: r.id }));
};

export const resolveClientForRecruit: LookupResolveFn = async (apiFn, option) => {
  // Stamp recruit_became_client_at so the picked directory client shows up
  // as a recruit client. The endpoint returns { id, created }, so the stored
  // value remains the client id (which is what FK columns expect).
  const result = await apiFn.post<FindOrCreateForClientResult>(
    '/clients/find-or-create-for-client',
    { clientId: option.value },
  );
  return { label: option.label, value: result.id };
};
