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

export interface LookupResult {
  label: string;
  value: string;
}

/**
 * Custom resolver — entities provide their own search/label implementation
 * instead of letting the resolver service build a generic table query. Used
 * by hand-written entities whose displayable name lives in another table
 * (e.g. recruit clients projecting `clients.name` via the `clientId` FK).
 *
 * The default resolver wired by `registerEntityLookup` from a `LookupConfig`
 * is itself just a `CustomLookupResolver` built from the table+columns spec.
 */
export interface CustomLookupResolver {
  search(query: string, limit: number): Promise<LookupResult[]>;
  getLabel(value: string): Promise<string | null>;
  getBatchLabels(values: string[]): Promise<Map<string, string>>;
}

export interface LookupResolver {
  /** Register an entity using the default table-based resolver. */
  register(config: LookupConfig): void;
  /** Register an entity with a custom resolver implementation. Use when the
   *  entity's labels live elsewhere (e.g. JOIN to a different table) and the
   *  generic table-based query can't express it. */
  registerResolver(entity: string, resolver: CustomLookupResolver): void;
}

/** DI token owning packages use to inject the resolver without importing
 *  `@packages/entity-engine` directly. entity-engine binds its concrete
 *  `LookupResolverService` under this token at module setup time. */
export const LOOKUP_RESOLVER_TOKEN = Symbol('LookupResolver');
