import { apiClient } from '../helpers/api-client';

export interface Law {
  id: string;
  code: string;
  name: string;
}

export type SystemLawCode = 'GST' | 'ITR' | 'TDS' | 'ROC' | 'PT';

/**
 * Looks up a system-seeded law by code. System laws are reseeded by
 * `resetState()`, so their UUIDs change between runs — never cache the
 * result across spec files. Within a single beforeAll it's safe to
 * stash the returned `id`.
 */
export async function getSystemLaw(code: SystemLawCode): Promise<Law> {
  const list = await apiClient.get<{ data: Law[] }>('/laws', { query: { limit: 50 } });
  const law = list.data.find((l) => l.code === code);
  if (!law) {
    throw new Error(
      `System law "${code}" not found. Has resetState() run, and is system-laws in the system seed list?`,
    );
  }
  return law;
}
