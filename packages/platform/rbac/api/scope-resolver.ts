import { Injectable } from '@nestjs/common';
import type { SQL } from '@packages/database';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Semantic column roles an entity exposes for scope enforcement. Entities
 * declare the columns that play well-known roles ('creator', 'assignee',
 * 'team', ...) in their `dataAccess.anchors` map; resolvers look those roles
 * up here. A missing anchor means the entity doesn't support the role — the
 * resolver returns `undefined` so the scope becomes a no-op for that entity.
 *
 * Anchor keys are open-ended: new scope kinds can introduce new anchor roles
 * without any change to the registry itself.
 */
export type ScopeAnchorMap = Record<string, PgColumn | undefined>;

/** Context handed to every resolver at query time. */
export interface ScopeResolverContext {
  /** Acting user id. Resolvers compare anchor columns against this. */
  userId: string;
  /** Anchor columns declared on the entity under enforcement. */
  anchors: ScopeAnchorMap;
}

/**
 * A single scope kind's enforcement logic. Receives the acting user and the
 * entity's anchor columns, returns a Drizzle SQL predicate or `undefined`.
 *
 * - Returning a predicate: "rows matching this SQL are in-scope."
 * - Returning `undefined`: "this resolver can't contribute for this entity"
 *   (e.g. `own` on an entity with no creator anchor). The caller treats it
 *   as no-op; other scopes the user holds may still grant access.
 *
 * Resolvers are stateless beyond their injected dependencies. Built-in
 * resolvers (`own`, `assigned`) live in this package; hierarchy resolvers
 * (`unit`, `descendants`) live in `@packages/org-units`; domain-specific
 * resolvers can be registered by any module.
 */
export interface ScopeResolver<P = Record<string, unknown> | undefined> {
  readonly type: string;
  /**
   * Anchor roles the resolver consults. Used at entity-engine init to decide
   * whether this resolver can contribute for a given entity and therefore
   * belongs in the entity's auto-derived permission manifest `supportedScopes`.
   *
   * Semantics: the resolver's scope is offered if **at least one** of the
   * declared anchors exists on the entity. Omit (or leave empty) for
   * resolvers that don't consult anchors — they're offered for every entity.
   */
  readonly requiredAnchors?: readonly string[];
  resolve(
    ctx: ScopeResolverContext,
    params: P,
  ): Promise<SQL | undefined> | SQL | undefined;
}

/**
 * Registry of scope resolvers. Populated at module init by rbac + opt-in
 * addons; consumed by entity-engine when enforcing row-level access. The
 * engine never branches on scope type — it iterates the registry, so new
 * scope kinds land as resolver registrations, not engine edits.
 */
@Injectable()
export class ScopeResolverRegistry {
  private readonly resolvers = new Map<string, ScopeResolver>();

  register(resolver: ScopeResolver): void {
    if (this.resolvers.has(resolver.type)) {
      throw new Error(`Scope resolver '${resolver.type}' is already registered`);
    }
    this.resolvers.set(resolver.type, resolver);
  }

  get(type: string): ScopeResolver | undefined {
    return this.resolvers.get(type);
  }

  has(type: string): boolean {
    return this.resolvers.has(type);
  }

  list(): string[] {
    return Array.from(this.resolvers.keys());
  }

  values(): ScopeResolver[] {
    return Array.from(this.resolvers.values());
  }
}
