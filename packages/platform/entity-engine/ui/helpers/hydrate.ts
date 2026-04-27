import type { EntityRegistryEntry } from '../types';
import type { EntityUIIndex } from './buildEntityUIIndex';

/**
 * Populate each entity's client-side `ui` block from the registered
 * `EntityUIConfig.presentation`. The api never sends `ui` over the wire —
 * it is wholly owned by the frontend.
 *
 * The same hydration philosophy applies to per-column `cellRenderer` and
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
    return { ...entity, ui: { ...presentation } };
  });
}
