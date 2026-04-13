/**
 * Interface for taxonomy operations (tag hydration).
 * Implemented by @packages/taxonomy when loaded.
 * When not loaded, tag fields are not hydrated in entity responses.
 */
export interface TaxonomyExtension {
  /** Get all tags attached to an entity, with group info. */
  getTagsForEntity(entityType: string, entityId: string): Promise<TagRef[]>;
}

/** Minimal tag shape entity-engine needs for response hydration. */
export interface TagRef {
  id: string;
  name: string;
  color?: string | null;
  groupSlug?: string;
}

/** NestJS injection token for the taxonomy extension. */
export const TAXONOMY_EXTENSION = 'TAXONOMY_EXTENSION';
