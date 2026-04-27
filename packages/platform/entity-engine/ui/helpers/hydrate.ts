import type { EntityRegistryEntry } from '../types';
import type { EntityUIIndex } from './buildEntityUIIndex';

/**
 * Merge presentation from registered EntityUIConfigs into each entity's
 * `ui` block. Frontend-side EntityUIConfig is the source of truth; backend
 * `ui` survives only as a fallback for entries not yet migrated.
 *
 * The same merge philosophy applies to per-column `cellRenderer` and
 * per-action `label`/`icon`/`variant`, but those happen inside the
 * relevant hooks (`useListLayout`, `useEntityLayout`) since they operate
 * on the layout response shape, not the registry entry.
 */
export function hydrateEntities(
  entities: EntityRegistryEntry[],
  index: EntityUIIndex,
): EntityRegistryEntry[] {
  if (index.presentation.size === 0) return entities;
  return entities.map((entity) => {
    const presentation = index.presentation.get(entity.entityType);
    if (!presentation) return entity;
    return { ...entity, ui: { ...entity.ui, ...presentation } };
  });
}
