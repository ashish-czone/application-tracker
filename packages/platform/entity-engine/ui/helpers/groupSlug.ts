/**
 * Derives a URL-safe slug from a `navGroup` label. Used to route grouped
 * entity pages — e.g. `navGroup: 'Content'` → `/content`, `navGroup: 'Customer Settings'` → `/customer-settings`.
 */
export function groupSlug(navGroup: string): string {
  return navGroup
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
