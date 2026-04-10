import type {
  FieldTypeDefinition,
  FieldTypePlugin,
  EavValueColumn,
  FilterOperator,
  StorageStrategy,
} from './types';

export class FieldTypeRegistry {
  private readonly types = new Map<string, FieldTypeDefinition>();
  private frozen = false;

  /** Register a single field type. Throws on duplicates or after freeze. */
  register(definition: FieldTypeDefinition): void {
    if (this.frozen) throw new Error(`Registry is frozen. Cannot register '${definition.type}'.`);
    if (this.types.has(definition.type)) {
      throw new Error(`Field type '${definition.type}' is already registered.`);
    }
    this.types.set(definition.type, definition);
  }

  /** Register all field types from a plugin. */
  registerPlugin(plugin: FieldTypePlugin): void {
    for (const ft of plugin.fieldTypes) {
      this.register(ft);
    }
  }

  /** Freeze — no more registrations allowed. */
  freeze(): void {
    this.frozen = true;
  }

  /** Get a field type by key. */
  get(type: string): FieldTypeDefinition | undefined {
    return this.types.get(type);
  }

  /** Get a field type or throw. */
  getOrThrow(type: string): FieldTypeDefinition {
    const def = this.types.get(type);
    if (!def) throw new Error(`Unknown field type '${type}'.`);
    return def;
  }

  /** Get all registered types. */
  getAll(): FieldTypeDefinition[] {
    return Array.from(this.types.values());
  }

  /** Get all creatable types, sorted by sortOrder. */
  getCreatable(): FieldTypeDefinition[] {
    return this.getAll().filter(t => t.creatable).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Check if a type has been registered. */
  has(type: string): boolean {
    return this.types.has(type);
  }

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------

  /** Get the storage strategy for a type. */
  getStorage(type: string): StorageStrategy {
    return this.getOrThrow(type).storage;
  }

  /** Get the EAV column for a type (only for 'eav' and 'json' storage). */
  getEavColumn(type: string): EavValueColumn | undefined {
    const storage = this.getStorage(type);
    if (storage.type === 'eav' || storage.type === 'json') return storage.column;
    return undefined;
  }

  /** Check if a type uses relational storage (junction tables). */
  isRelational(type: string): boolean {
    const def = this.types.get(type);
    if (!def) return false;
    return def.storage.type === 'relational';
  }

  // ---------------------------------------------------------------------------
  // Derived maps — backward-compat bridges for existing constants
  // ---------------------------------------------------------------------------

  /** Build FIELD_TYPE_TO_VALUE_COLUMN map. */
  toValueColumnMap(): Partial<Record<string, EavValueColumn>> {
    const map: Partial<Record<string, EavValueColumn>> = {};
    for (const ft of this.types.values()) {
      const col = this.getEavColumn(ft.type);
      if (col) map[ft.type] = col;
    }
    return map;
  }

  /** Build RELATIONAL_FIELD_TYPES set. */
  toRelationalSet(): Set<string> {
    const set = new Set<string>();
    for (const ft of this.types.values()) {
      if (ft.storage.type === 'relational') set.add(ft.type);
    }
    return set;
  }

  /** Build OPERATORS_BY_FIELD_TYPE map. */
  toOperatorsMap(): Record<string, FilterOperator[]> {
    const map: Record<string, FilterOperator[]> = {};
    for (const ft of this.types.values()) {
      map[ft.type] = ft.filterOperators;
    }
    return map;
  }

  /** Get filter operators for a type. */
  getFilterOperators(type: string): FilterOperator[] {
    return this.getOrThrow(type).filterOperators;
  }
}

/** Singleton registry — shared across the entire application. */
export const fieldTypeRegistry = new FieldTypeRegistry();
