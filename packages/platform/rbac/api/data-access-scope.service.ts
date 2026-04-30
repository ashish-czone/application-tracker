import { Injectable } from '@nestjs/common';
import { or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { DataAccessContext } from './scope-context';
import { ScopeResolverRegistry, type ScopeAnchorMap } from './scope-resolver';

/**
 * Per-entity inline scope resolver — for scope kinds whose SQL can't be
 * expressed through the generic anchor map (e.g. a domain-specific scope
 * like `compliance.team-lead-of-client` that walks an extra table). Declared
 * alongside the entity (entity-engine-style configs) or alongside the
 * domain service (hand-written services).
 */
export interface InlineScopeResolver {
  /** Scope type this resolver handles. Matched against `AccessScopeSpec.type`. */
  readonly key: string;
  resolve(userId: string): SQL | undefined;
}

/**
 * Inputs `DataAccessScopeService.buildPredicate` needs to resolve the
 * `scopes` array on a `DataAccessContext` into a single SQL predicate.
 * The caller supplies the table's anchor columns (no entity config required)
 * plus any per-entity inline resolvers.
 */
export interface BuildScopePredicateOptions {
  /**
   * The table's `column-role → column` map. Empty map means "this table
   * declares no anchors"; resolvers that don't consult anchors still run,
   * resolvers that do (`own`, `assigned`, `unit`, ...) become no-ops.
   */
  anchors: ScopeAnchorMap;
  /**
   * Optional per-entity inline scopes. Used when a domain has scope kinds
   * that don't fit the generic registry (e.g. one-off conditional joins).
   * Consulted only when the scope type isn't found in the global registry.
   */
  inlineResolvers?: ReadonlyArray<InlineScopeResolver>;
}

/**
 * Builds row-level RBAC scope predicates without requiring entity-engine.
 *
 * Apps that use entity-engine get scope enforcement automatically through
 * `EntityService` (which delegates here). Apps that hand-write services and
 * issue raw Drizzle / SQL queries — and there are first-class library
 * use-cases for that — inject `DataAccessScopeService` directly and AND its
 * returned predicate into their WHERE clause:
 *
 * ```ts
 * const scopePredicate = await this.dataAccessScope.buildPredicate(ctx, {
 *   anchors: { creator: clients.createdBy, team: clients.complianceAccountManagerId },
 * });
 *
 * await this.database.db
 *   .select()
 *   .from(clients)
 *   .where(withScope(clients, scopePredicate, eq(clients.complianceStatus, 'active')));
 * ```
 *
 * Semantics:
 * - `ctx.scopes.length === 0` → returns `1=0` (deny). The user holds no
 *   grant for this verb; no rows are in scope.
 * - Any scope of type `'any'` in the array → returns `undefined` (no filter).
 *   `any` is the most permissive scope and wins.
 * - Otherwise: each scope dispatches through the global `ScopeResolverRegistry`,
 *   then falls back to a caller-supplied inline resolver. Per-scope predicates
 *   are OR-ed.
 * - Unknown scope types (no registered or inline resolver) log a warning and
 *   are dropped — degrades gracefully when a stale scope sits on an old role
 *   grant after a resolver was deregistered. If every scope drops, the result
 *   is `1=0` (no access).
 */
@Injectable()
export class DataAccessScopeService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly registry: ScopeResolverRegistry,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(DataAccessScopeService.name);
  }

  async buildPredicate(
    ctx: DataAccessContext,
    options: BuildScopePredicateOptions,
  ): Promise<SQL | undefined> {
    if (ctx.scopes.length === 0) {
      return sql`1=0`;
    }

    if (ctx.scopes.some((s) => s.type === 'any')) {
      return undefined;
    }

    const predicates: SQL[] = [];

    for (const scope of ctx.scopes) {
      const registered = this.registry.get(scope.type);
      if (registered) {
        const result = await registered.resolve(
          { userId: ctx.userId, anchors: options.anchors },
          scope.params,
        );
        if (result) predicates.push(result);
        continue;
      }

      const inline = options.inlineResolvers?.find((r) => r.key === scope.type);
      if (inline) {
        const result = inline.resolve(ctx.userId);
        if (result) predicates.push(result);
        continue;
      }

      this.logger.warn(`Unknown data access scope type: ${scope.type}`);
    }

    if (predicates.length === 0) return sql`1=0`;
    if (predicates.length === 1) return predicates[0];
    return or(...predicates)!;
  }
}
