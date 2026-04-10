import type { FieldTypeUIDefinition } from './types';

/**
 * UI-side field type registry.
 * Maps field type strings to their React components and Zod schemas.
 * Populated by UI packages at import time.
 */
class FieldTypeUIRegistry {
  private readonly types = new Map<string, FieldTypeUIDefinition>();

  register(definition: FieldTypeUIDefinition): void {
    this.types.set(definition.type, definition);
  }

  registerAll(definitions: FieldTypeUIDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  get(type: string): FieldTypeUIDefinition | undefined {
    return this.types.get(type);
  }

  getOrThrow(type: string): FieldTypeUIDefinition {
    const def = this.types.get(type);
    if (!def) throw new Error(`No UI definition registered for field type '${type}'.`);
    return def;
  }

  has(type: string): boolean {
    return this.types.has(type);
  }

  getAll(): FieldTypeUIDefinition[] {
    return Array.from(this.types.values());
  }
}

export const fieldTypeUIRegistry = new FieldTypeUIRegistry();
