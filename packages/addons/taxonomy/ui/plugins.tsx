import type { HeaderPlugin } from '@packages/entity-engine-ui';
import { useEntityEngine, useEntityConfig } from '@packages/entity-engine-ui';
import { EntityTagsChipRow } from './components/EntityTagsChipRow';
import { readTagsFeature } from './feature';

/**
 * Detail-page header plugin that renders an inline editable chip row of tags.
 * Pulls `apiFn` from the entity-engine context so the plugin matches the
 * generic HeaderPlugin shape.
 */
function TagsHeaderComponent({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { apiFn } = useEntityEngine();
  const entity = useEntityConfig(entityType);
  const tags = readTagsFeature(entity.features);
  if (!tags) return null;
  return (
    <EntityTagsChipRow
      apiFn={apiFn}
      entityType={entityType}
      entityId={entityId}
      groupSlug={tags.groupSlug}
    />
  );
}

export const tagsHeaderPlugin: HeaderPlugin = {
  key: 'tags',
  order: 0,
  component: TagsHeaderComponent,
  enabledFor: (entity) => !!readTagsFeature(entity.features),
};
