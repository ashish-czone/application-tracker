import type { EntityConfig } from '../types';

/**
 * Convert a kebab-case or snake_case slug into a humanized display name.
 * `'job-openings'` → `'Job openings'` (or `'Job opening'` when `singular`).
 * Used as a fallback when an `EntityConfig` doesn't declare singularName /
 * pluralName explicitly — FE-registered names take precedence on the wire
 * via `EntityUIConfig.presentation.singularName` / `pluralName`.
 */
export function humanizeSlug(slug: string, opts: { singular: boolean }): string {
  const words = slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/);
  if (words.length === 0) return slug;
  if (opts.singular) {
    const last = words[words.length - 1];
    if (last.endsWith('ies') && last.length > 3) {
      words[words.length - 1] = last.slice(0, -3) + 'y';
    } else if (last.endsWith('s') && last.length > 1 && !last.endsWith('ss')) {
      words[words.length - 1] = last.slice(0, -1);
    }
  }
  return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
    + (words.length > 1 ? ' ' + words.slice(1).map((w) => w.toLowerCase()).join(' ') : '');
}

/**
 * Mutate the config in place to populate `singularName` / `pluralName` from
 * the slug-derived fallback when they are missing. Idempotent — calling
 * with already-populated names is a no-op. Both `EntityRegistryService.register`
 * and the `forEntity` factory use this so EntityService's ctor always sees a
 * populated identity (it runs before bootstrap registers the entity).
 */
export function ensureRegisteredIdentity(config: EntityConfig): void {
  if (!config.singularName) {
    config.singularName = humanizeSlug(config.slug, { singular: true });
  }
  if (!config.pluralName) {
    config.pluralName = humanizeSlug(config.slug, { singular: false });
  }
}
