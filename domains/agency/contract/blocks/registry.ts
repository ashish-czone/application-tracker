import type { MapperDefinition } from './types';

/**
 * Registry of entity → block mappers, keyed by `(entity, blockKind)`. Populated
 * at server startup by each addon that contributes content blocks. The pages
 * public-response service looks up a mapper per section to transform raw entity
 * records into the block's typed prop shape before returning.
 *
 * Re-registering the same pair replaces the entry — intentional, so themes and
 * apps can override a default mapper without having to unregister first.
 */
class MapperRegistryImpl {
  private readonly byKey = new Map<string, MapperDefinition>();

  private key(entity: string, block: string): string {
    return `${entity}::${block}`;
  }

  register<TRecord, TProps extends Record<string, unknown>>(
    def: MapperDefinition<TRecord, TProps>,
  ): void {
    this.byKey.set(this.key(def.entity, def.block), def as MapperDefinition);
  }

  registerAll(defs: MapperDefinition[]): void {
    for (const d of defs) this.register(d);
  }

  get(entity: string, block: string): MapperDefinition | undefined {
    return this.byKey.get(this.key(entity, block));
  }

  has(entity: string, block: string): boolean {
    return this.byKey.has(this.key(entity, block));
  }

  list(): MapperDefinition[] {
    return Array.from(this.byKey.values());
  }

  /** Clears the registry. Intended for tests — no production caller. */
  clear(): void {
    this.byKey.clear();
  }
}

export type MapperRegistry = MapperRegistryImpl;

/** Singleton consumed by both the server (resolves section data) and the admin preview. */
export const mapperRegistry: MapperRegistry = new MapperRegistryImpl();

/**
 * Declarative mapper definition. Returns the same object — the helper exists
 * to pin the `TRecord`/`TProps` generics so the `map` function is correctly
 * typed at call sites.
 */
export function defineMapper<TRecord, TProps extends Record<string, unknown>>(
  def: MapperDefinition<TRecord, TProps>,
): MapperDefinition<TRecord, TProps> {
  return def;
}
