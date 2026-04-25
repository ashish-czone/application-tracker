import { Injectable } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Hook context — passed to all hooks
// ---------------------------------------------------------------------------

export interface FieldTypeSaveHookContext {
  entityType: string;
  entityId: string;
  fieldKey: string;
  fieldType: string;
  /** 'create' or 'update' */
  mode: 'create' | 'update';
  actorId: string;
  /** For updates: the previous value of this field (if available) */
  previousValue?: unknown;
}

// ---------------------------------------------------------------------------
// Hook result — returned by onBeforeSave
// ---------------------------------------------------------------------------

export interface FieldTypeSaveHookResult {
  /** If set, replaces the original value before persistence */
  transformedValue?: unknown;
}

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

/** Runs BEFORE the transaction. Can transform values or throw to abort. */
export type OnBeforeSaveHook = (
  value: unknown,
  ctx: FieldTypeSaveHookContext,
) => Promise<FieldTypeSaveHookResult>;

/** Runs AFTER the transaction commits. Failures are logged, never block. */
export type OnAfterSaveHook = (
  value: unknown,
  ctx: FieldTypeSaveHookContext,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Hook bundle per field type
// ---------------------------------------------------------------------------
//
// `onTransactionalSave` was removed in favour of explicit per-entity
// composition (per-entity services open their own tx and call
// taxonomy/multi-value services directly). `onBeforeSave` stays for
// pure value transformations like media's tmp→entity file move; it
// runs outside the engine's transaction and does not write to side
// tables.

export interface FieldTypeSaveHooks {
  onBeforeSave?: OnBeforeSaveHook;
  onAfterSave?: OnAfterSaveHook;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

@Injectable()
export class FieldTypeSaveHookRegistry {
  private readonly hooks = new Map<string, FieldTypeSaveHooks>();

  /** Register hooks for a field type. Throws on duplicate. */
  register(fieldType: string, hooks: FieldTypeSaveHooks): void {
    if (this.hooks.has(fieldType)) {
      throw new Error(`Save hooks already registered for field type '${fieldType}'.`);
    }
    this.hooks.set(fieldType, hooks);
  }

  /** Get hooks for a field type. Returns undefined if none registered. */
  get(fieldType: string): FieldTypeSaveHooks | undefined {
    return this.hooks.get(fieldType);
  }

  /** Check if hooks are registered for a field type. */
  has(fieldType: string): boolean {
    return this.hooks.has(fieldType);
  }
}

/**
 * Module-level singleton — guarantees a single instance regardless of
 * NestJS module scoping or webpack deduplication quirks.
 */
export const fieldTypeSaveHookRegistry = new FieldTypeSaveHookRegistry();
