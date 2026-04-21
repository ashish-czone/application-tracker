/**
 * Context passed to every RelationHandler method. Carries a snapshot of the
 * parent entity's standard-column values so the handler can derive values it
 * needs without the caller having to duplicate them into the nested payload.
 *
 * Example: an auth package's credentials handler reads `ctx.parent.email`
 * as the login identifier instead of requiring the users DTO to ship email
 * twice (once on the parent, once nested under `credentials`).
 */
export interface RelationHandlerContext {
  /** Standard-column snapshot of the parent row after create/update, or the
   *  row being deleted. Custom-field values and relational values are NOT
   *  included — only the fields that live on the parent's own table. */
  parent: Record<string, unknown>;
}

/**
 * Contract for packages that own tables related to an entity via a declared
 * `EntityRelationship`. Each method is optional — implement only what you need.
 * All methods run inside the caller's transaction (`tx`).
 *
 * Lives in `@packages/entity-engine-contract` (not `@packages/entity-engine`)
 * so owning packages like `@packages/auth` and `@packages/rbac` can implement
 * handlers without forming a circular dep on entity-engine itself.
 */
export interface RelationHandler {
  /** Invoked after the parent entity is inserted. Payload is the sub-value from the relation key (e.g. `{ password: '...' }` for hasOne, `[id1, id2]` for manyToMany). */
  onCreate?(tx: unknown, parentId: string, payload: unknown, actorId: string, ctx: RelationHandlerContext): Promise<void>;
  /** Invoked when the relation key is present in an update DTO. */
  onUpdate?(tx: unknown, parentId: string, payload: unknown, actorId: string, ctx: RelationHandlerContext): Promise<void>;
  /**
   * Invoked when the parent entity is deleted. `kind` tells the handler
   * whether the parent is being soft- or hard-deleted so it can decide how
   * to react (e.g. leave credential rows alone on soft delete but purge
   * them on hard delete).
   */
  onDelete?(tx: unknown, parentId: string, actorId: string, opts: { kind: 'soft' | 'hard' }, ctx: RelationHandlerContext): Promise<void>;
}
