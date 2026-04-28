import type { BlockDefinition } from './types';

/**
 * Block registry — populated at app startup via `registerBlocks([...])` or
 * incremental `register(def)` calls. Both admin (picker + editor) and public
 * site (renderer) read from this singleton so they stay in sync.
 *
 * Re-registering the same `kind` replaces the entry. Intentional — lets a
 * theme override a built-in block without having to unregister first.
 */
class BlockRegistryImpl {
  private readonly byKind = new Map<string, BlockDefinition>();

  register<T extends Record<string, unknown>>(def: BlockDefinition<T>): void {
    this.byKind.set(def.kind, def as BlockDefinition);
  }

  registerAll(defs: BlockDefinition[]): void {
    for (const d of defs) this.register(d);
  }

  get(kind: string): BlockDefinition | undefined {
    return this.byKind.get(kind);
  }

  has(kind: string): boolean {
    return this.byKind.has(kind);
  }

  list(): BlockDefinition[] {
    return Array.from(this.byKind.values());
  }

  listByCategory(): Record<string, BlockDefinition[]> {
    const grouped: Record<string, BlockDefinition[]> = {};
    for (const def of this.byKind.values()) {
      const key = def.category ?? 'Other';
      (grouped[key] ??= []).push(def);
    }
    return grouped;
  }

  /** Clears the registry. Intended for tests — no production caller. */
  clear(): void {
    this.byKind.clear();
  }
}

export type BlockRegistry = BlockRegistryImpl;

/** Singleton used by both the admin editor and the public renderer. */
export const blockRegistry: BlockRegistry = new BlockRegistryImpl();

/**
 * Declarative block definition. Returns the same object — the helper exists
 * to give TypeScript a handle for the `TFields` generic so `component` props
 * are correctly typed against `fields`.
 */
export function defineBlock<TFields extends Record<string, unknown>>(
  def: BlockDefinition<TFields>,
): BlockDefinition<TFields> {
  return def;
}
