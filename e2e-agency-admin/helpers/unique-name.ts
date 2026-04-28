import { randomBytes } from 'node:crypto';

/**
 * Returns a short URL-safe random suffix. Used to namespace test entities
 * so parallel/sequential runs never collide and so cleanup can target only
 * what this run created.
 */
export function randomSuffix(length = 8): string {
  return randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Build a unique entity name with the `E2E_` prefix.
 * @example uniqueName('Project') → 'E2E_a3f1c2d8_Project'
 */
export function uniqueName(label: string): string {
  return `E2E_${randomSuffix()}_${label}`;
}

/**
 * Build a unique slug-style identifier (lowercase, dash-separated).
 * @example uniqueSlug('project') → 'e2e-a3f1c2d8-project'
 */
export function uniqueSlug(label: string): string {
  return `e2e-${randomSuffix()}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
