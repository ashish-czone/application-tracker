import type { EntityConfig } from '../types';

/**
 * Returns the infrastructure column keys that must appear in list SELECT
 * maps for an entity, based on opt-in flags on the config.
 *
 * These columns are maintained by the platform, not by user forms, so they
 * are never registered as user-editable fields — but list consumers (tree
 * renderers, drag-drop UIs) need them to decide parent/child relationships,
 * nesting depth, and sibling ordering. Without this projection the
 * frontend receives rows without `parentId`/`depth`/`sortOrder` and cannot
 * render a meaningful tree.
 */
export function infrastructureSelectKeys(config: Pick<EntityConfig, 'hierarchy' | 'orderable'>): string[] {
  const keys: string[] = [];
  if (config.hierarchy) keys.push('parentId', 'path', 'depth');
  if (config.orderable) keys.push('sortOrder');
  return keys;
}
