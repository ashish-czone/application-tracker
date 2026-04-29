import type { ScopeResolver } from '@packages/rbac';
import type { EntityConfig } from '../types';

/**
 * Compute the set of scope types valid for an entity's permissions. Used
 * when entity-engine auto-synthesizes PermissionManifests at boot.
 *
 * Rules, in priority order:
 *  - `any` is always available (no row restriction).
 *  - A registered scope resolver contributes its `type` when at least one of
 *    its `requiredAnchors` is declared on the entity. Resolvers without
 *    declared anchors (or an empty list) contribute for every entity.
 *  - Entity-inline scopes (`config.dataAccess.scopes[].key`) are always
 *    included — they're author-defined and entity-specific.
 */
export function deriveSupportedScopes(
  config: Pick<EntityConfig, 'dataAccess'>,
  resolvers: readonly ScopeResolver[],
): string[] {
  const declaredAnchors = new Set(Object.keys(config.dataAccess?.anchors ?? {}));
  const scopes = new Set<string>(['any']);
  for (const resolver of resolvers) {
    const required = resolver.requiredAnchors;
    if (!required || required.length === 0) {
      scopes.add(resolver.type);
      continue;
    }
    if (required.some((r) => declaredAnchors.has(r))) {
      scopes.add(resolver.type);
    }
  }
  for (const inline of config.dataAccess?.scopes ?? []) {
    scopes.add(inline.key);
  }
  return Array.from(scopes);
}
