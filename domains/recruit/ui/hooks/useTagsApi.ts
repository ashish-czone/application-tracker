import { useQuery } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';

export interface TagGroup {
  id: string;
  name: string;
  slug: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

export function useTagGroupBySlug(slug: string) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['tag-groups'],
    queryFn: () => apiFn.get<{ data: TagGroup[] }>('/tag-groups'),
    select: (response) => response.data.find((g) => g.slug === slug),
  });
}

export function useTagsByGroup(groupId: string | undefined) {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['tags', groupId],
    queryFn: () => apiFn.get<Tag[]>(`/tag-groups/${groupId}/tags`),
    enabled: !!groupId,
  });
}
