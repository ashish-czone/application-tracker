import { useMemo, useCallback } from 'react';
import { ChipInput, type ChipOption } from '@packages/ui';
import { createEntityTaxonomyApi } from '../services';
import { useEntityTags, useSetEntityTags } from '../hooks';
import type { ApiFn } from '../types';

interface EntityTagsChipRowProps {
  apiFn: ApiFn;
  entityType: string;
  entityId: string;
  groupSlug: string;
  /** When true, chips are readonly (no add/remove affordance). */
  disabled?: boolean;
  className?: string;
}

/**
 * Inline, editable tag chip row for an entity detail page.
 * Mutations update the TanStack Query cache immediately on success — each
 * change triggers a PUT that replaces the tag set within `groupSlug`.
 */
export function EntityTagsChipRow({
  apiFn,
  entityType,
  entityId,
  groupSlug,
  disabled,
  className,
}: EntityTagsChipRowProps) {
  const taxonomyApi = useMemo(() => createEntityTaxonomyApi(apiFn), [apiFn]);
  const { data: allTags, isLoading } = useEntityTags(apiFn, entityType, entityId);
  const { mutate: setTags, isPending } = useSetEntityTags(apiFn, entityType, entityId, groupSlug);

  const tagsInGroup = useMemo(
    () => (allTags ?? []).filter((t) => t.groupSlug === groupSlug),
    [allTags, groupSlug],
  );

  const selectedValues = useMemo(() => tagsInGroup.map((t) => t.id), [tagsInGroup]);
  const initialSelected = useMemo<ChipOption[]>(
    () =>
      tagsInGroup.map((t) => ({
        value: t.id,
        label: t.name,
        color: t.color ?? undefined,
      })),
    [tagsInGroup],
  );

  const onSearch = useCallback(
    async (query: string): Promise<ChipOption[]> => {
      const results = await taxonomyApi.searchTagOptions(groupSlug, query);
      return results.map((r) => ({ value: r.value, label: r.label, color: r.color }));
    },
    [taxonomyApi, groupSlug],
  );

  const handleChange = useCallback(
    (nextValues: string[]) => {
      setTags(nextValues);
    },
    [setTags],
  );

  if (isLoading) {
    return <div className={className} aria-busy="true" />;
  }

  return (
    <div className={className}>
      <ChipInput
        selectedValues={selectedValues}
        initialSelected={initialSelected}
        onChange={handleChange}
        onBlur={() => {}}
        onSearch={onSearch}
        placeholder="Add tag…"
        disabled={disabled || isPending}
        inputId={`entity-tags-${entityType}-${entityId}`}
      />
    </div>
  );
}
