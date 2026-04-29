import type { EntityRegistryEntry } from '../types';
import type { EntityUIIndex } from './buildEntityUIIndex';

/**
 * Populate each entity's client-side `ui` block from the registered
 * `EntityUIConfig.presentation`, and override `singularName`/`pluralName`/
 * `subtitleField` when an FE-side value is registered (FE is moving to the
 * source of truth for these — Strip B-4 will drop them from the api wire).
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
    const { singularName, pluralName, subtitleField, ...uiOnly } = presentation;
    return {
      ...entity,
      singularName: singularName ?? entity.singularName,
      pluralName: pluralName ?? entity.pluralName,
      subtitleField: subtitleField ?? entity.subtitleField,
      ui: { ...uiOnly },
    };
  });
}
