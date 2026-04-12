import type { ApiFn } from '@packages/platform-ui/PlatformUIProvider';
import type { EntityTag, TagOption } from './types';

export function createTaxonomyApi(api: ApiFn) {
  return {
    getEntityTags(entityType: string, entityId: string): Promise<EntityTag[]> {
      return api.get<EntityTag[]>(`/entities/${entityType}/${entityId}/tags`);
    },

    setEntityTags(
      entityType: string,
      entityId: string,
      groupSlug: string,
      tagIds: string[],
    ): Promise<EntityTag[]> {
      return api.put<EntityTag[]>(`/entities/${entityType}/${entityId}/tags`, {
        groupSlug,
        tagIds,
      });
    },

    searchTagOptions(groupSlug: string, search?: string, limit = 20): Promise<TagOption[]> {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      qs.set('limit', String(limit));
      return api.get<TagOption[]>(`/tags/group/${groupSlug}?${qs.toString()}`);
    },
  };
}

export type TaxonomyUiApi = ReturnType<typeof createTaxonomyApi>;
