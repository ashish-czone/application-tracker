import { useCallback } from 'react';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import type { ChipOption } from '@packages/ui/components/form/FormChipInput';
import { useEntityEngine } from '../EntityEngineProvider';

type LookupOption = { label: string; value: string };
type SearchFn = (query: string) => Promise<LookupOption[]>;
type ChipSearchFn = (query: string) => Promise<ChipOption[]>;
type ResolveFn = (option: LookupOption) => Promise<LookupOption>;

/**
 * Resolves per-field picker handlers for a given entity, honoring FE-side
 * `FieldUI.lookupSearch` and `FieldUI.lookupResolveValue` overrides before
 * falling back to the platform defaults (`/lookups/{entityType}`,
 * `/users?search=`, `/tags/group/{slug}`). Used by EntityCreatePage,
 * EntityEditPage and EntityQuickCreateForm so the override path is
 * declared once.
 */
export function useLookupHandlers(entityType: string) {
  const { apiFn, getFieldUI } = useEntityEngine();

  const searchUsers = useCallback<SearchFn>(async (query) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(
      `/users?search=${encodeURIComponent(query)}&limit=20&sort=firstName&order=asc`,
    );
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback<(entity: string, query: string) => Promise<LookupOption[]>>(
    async (entity, query) => {
      return apiFn.get<LookupOption[]>(`/lookups/${entity}?search=${encodeURIComponent(query)}&limit=20`);
    },
    [apiFn],
  );

  const searchTags = useCallback<(groupSlug: string, query: string) => Promise<ChipOption[]>>(
    async (groupSlug, query) => {
      return apiFn.get<ChipOption[]>(`/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`);
    },
    [apiFn],
  );

  const onSearchFor = useCallback(
    (field: FieldDefinition): SearchFn | undefined => {
      const ui = getFieldUI(entityType, field.fieldKey);
      if (ui?.lookupSearch) return (q) => ui.lookupSearch!(apiFn, q);
      if (field.fieldType === 'user') return searchUsers;
      if (field.fieldType === 'lookup' && field.lookupEntity) {
        return (q) => searchLookup(field.lookupEntity!, q);
      }
      return undefined;
    },
    [entityType, getFieldUI, apiFn, searchUsers, searchLookup],
  );

  const onChipSearchFor = useCallback(
    (field: FieldDefinition): ChipSearchFn | undefined => {
      if (field.fieldType === 'multi_user') return searchUsers;
      if (field.fieldType === 'multi_lookup' && field.lookupEntity) {
        return (q) => searchLookup(field.lookupEntity!, q);
      }
      if (field.fieldType === 'tags' && field.tagGroupSlug) {
        return (q) => searchTags(field.tagGroupSlug!, q);
      }
      return undefined;
    },
    [searchUsers, searchLookup, searchTags],
  );

  const onResolveFor = useCallback(
    (field: FieldDefinition): ResolveFn | undefined => {
      const ui = getFieldUI(entityType, field.fieldKey);
      if (!ui?.lookupResolveValue) return undefined;
      return (option) => ui.lookupResolveValue!(apiFn, option);
    },
    [entityType, getFieldUI, apiFn],
  );

  return { onSearchFor, onChipSearchFor, onResolveFor };
}
