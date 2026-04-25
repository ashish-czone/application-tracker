/**
 * Contract for registering an entity as a lookup target used by `lookup` /
 * `multi_lookup` form fields (search-by-label, select-by-id pickers).
 *
 * Lives in `@packages/entity-engine-contract` (not `@packages/entity-engine`)
 * so owning packages like `@packages/rbac` can register their tables without
 * forming a circular dep on entity-engine itself.
 */
export interface LookupConfig {
  entity: string;
  /** Drizzle table reference. Typed loosely because the contract package
   *  doesn't depend on any specific schema. */
  table: any;
  labelField: string;
  /** When set, label is built by concatenating these fields with a space
   *  (overrides labelField for display). */
  labelFields?: string[];
  valueField: string;
  searchFields: string[];
}

export interface LookupResolver {
  register(config: LookupConfig): void;
}

/** DI token owning packages use to inject the resolver without importing
 *  `@packages/entity-engine` directly. entity-engine binds its concrete
 *  `LookupResolverService` under this token at module setup time. */
export const LOOKUP_RESOLVER_TOKEN = Symbol('LookupResolver');
