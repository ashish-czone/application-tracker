import { Injectable, NotFoundException, type Provider } from '@nestjs/common';
import { count, DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import {
  DataAccessScopeService,
  type BuildScopePredicateOptions,
  type DataAccessContext,
} from '@packages/rbac';
import type { SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';

/**
 * Constraint for tables that BaseCrudService can manage. The table must
 * expose an `id` column (UUID text). Other columns are open.
 */
export type TableWithId = PgTable & { id: PgColumn };

/**
 * Standard list query envelope. Subclass-specific filter params live on
 * the consumer's own DTOs and are translated into `withScope`-compatible
 * predicates by the consumer before delegating to `BaseCrudService.list`
 * (or, for richer queries, the consumer issues its own scoped query).
 */
export interface BaseListQuery {
  page?: number;
  limit?: number;
}

/**
 * Configuration for `BaseCrudService`.
 */
export interface BaseCrudOptions {
  /** Slug used for logging context and event entityType, e.g. `compliance-rules`. */
  slug: string;
  /** Optional event names emitted on create/update/softDelete. */
  events?: {
    created?: string;
    updated?: string;
    deleted?: string;
  };
  /** Default page size for `list` (default: 25). */
  defaultLimit?: number;
  /** Max page size for `list` — clamps higher values silently (default: 100). */
  maxLimit?: number;
  /**
   * Optional row-level RBAC scope shape. When provided AND a method is
   * called with an `accessCtx`, the base ANDs a scope predicate (built via
   * `DataAccessScopeService.buildPredicate`) into the WHERE of every
   * scope-aware path (`list`, `findOne`, `update`, `softDelete`).
   *
   * The predicate covers the **default CRUD permissions** for the entity —
   * `<slug>.read` (gates `list` / `findOne` / pre-read of `update` /
   * `softDelete`) and `<slug>.update` (gates the actual UPDATE/DELETE
   * statement). Non-default permissions (transitions, custom actions,
   * report aggregations) are out of scope for the base — the consuming
   * service hand-rolls `buildPredicate` for those, same as today.
   *
   * Omit `scope` for entities whose only declared scope is `'all'` /
   * `'any'` (`organizations`, `laws`) — passing it would just no-op.
   */
  scope?: BuildScopePredicateOptions;
}

/**
 * Composable CRUD service.
 *
 * Consumers receive a configured instance via DI under a stable token
 * (`createCrudProvider('CRUD_<slug>', table, options)`) and **delegate** per
 * method rather than extending. This is deliberate: composition keeps the
 * decision tree at the consumer ("does my `create` need an invariant?
 * call `this.crud.create` after checking, or skip it entirely") explicit
 * and grep-friendly. No method-resolution-order, no decorator inheritance
 * footguns, no factory class returned.
 *
 * Composes:
 *   - `withScope(table, …)` for tenant + soft-delete scoping (no-op on tables
 *     without those columns)
 *   - **Actor-scope predicates** when `options.scope` is configured AND the
 *     caller passes `accessCtx`. The predicate ANDs into the same `withScope`
 *     call so soft-delete + tenant + actor-scope all flow through one WHERE.
 *     Built via `DataAccessScopeService.buildPredicate(ctx, options.scope)`;
 *     `'any'` scope returns `undefined` (free path, no predicate added);
 *     empty scope array returns `1=0` (deny — caller sees zero rows / 404).
 *   - Optional event emission on create/update/softDelete (configured via
 *     `options.events`)
 *   - Logger context bound to `options.slug`
 *
 * Does NOT compose (intentionally — each is the consumer's job):
 *   - **Workflow transitions** — call the workflow engine directly from a
 *     consumer method
 *   - **Lookup hydration** — query lookup tables explicitly in your custom
 *     read methods
 *   - **Permission checks** — controllers handle via `@RequirePermission`
 *   - **Validation** — controllers handle via `Schema.parse(body)`
 *   - **Non-default-permission scope predicates** — for transitions, custom
 *     actions, or report aggregations gated by a non-CRUD permission slug,
 *     consumers call `DataAccessScopeService.buildPredicate(ctx, …)`
 *     themselves with the right anchors and apply it inline.
 *
 * @example
 *   // module: provide one BaseCrudService instance per entity behind a token
 *   providers: [
 *     createCrudProvider('CRUD_clients', clients, {
 *       slug: 'clients',
 *       events: { created: 'clients.Created', ... },
 *       scope: { anchors: CLIENTS_ANCHORS, inlineResolvers: CLIENTS_INLINE_SCOPES },
 *     }),
 *     ClientsService,
 *   ]
 *
 *   // service: inject and delegate per method; pass accessCtx through
 *   @Injectable()
 *   export class ClientsService {
 *     constructor(
 *       @Inject('CRUD_clients')
 *       private readonly crud: BaseCrudService<typeof clients>,
 *     ) {}
 *
 *     async list(query, ctx?) { return this.crud.list(query, ctx); }
 *     async findOne(id, ctx?) { return this.crud.findOneOrFail(id, ctx); }
 *   }
 */
@Injectable()
export class BaseCrudService<TTable extends TableWithId = TableWithId> {
  private readonly logger: ContextLogger;
  private readonly defaultLimit: number;
  private readonly maxLimit: number;

  constructor(
    private readonly table: TTable,
    private readonly options: BaseCrudOptions,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly dataAccessScope: DataAccessScopeService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(`BaseCrudService:${options.slug}`);
    this.defaultLimit = options.defaultLimit ?? 25;
    this.maxLimit = options.maxLimit ?? 100;
  }

  /**
   * Resolve the actor-scope predicate for the current call. Returns
   * `undefined` when scope can't or shouldn't apply:
   *  - no `accessCtx` (caller is privileged or doesn't care)
   *  - no `options.scope` registered (entity has only `'all'` scope)
   *  - the resolved scope contains `'any'` — `buildPredicate` returns
   *    `undefined` itself, which we pass through.
   * Returns `1=0` for the deny case (empty / unknown scopes); flows through
   * `withScope` and short-circuits the WHERE to no matches.
   */
  private async resolveScopePredicate(
    accessCtx?: DataAccessContext,
  ): Promise<SQL | undefined> {
    if (!accessCtx || !this.options.scope) return undefined;
    return this.dataAccessScope.buildPredicate(accessCtx, this.options.scope);
  }

  /**
   * List rows with pagination. Applies tenant + soft-delete + actor-scope
   * (when configured) via `withScope`. Search/sort/structured filters are
   * not implemented in the base — consumers compose their own `list` and
   * call this only for the trivial pagination case.
   *
   * `meta.total` comes from a sibling SQL `count()` query issued against
   * the same WHERE as the rows query, so the rendered page and the
   * reported total always agree. `meta.totalPages` is `ceil(total/limit)`,
   * floored to at least `1` so empty result sets still render an "of 1"
   * page indicator.
   */
  async list(
    query: BaseListQuery = {},
    accessCtx?: DataAccessContext,
  ): Promise<{
    data: TTable['$inferSelect'][];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    type Row = TTable['$inferSelect'];
    const limitRaw = query.limit ?? this.defaultLimit;
    const limit = Math.max(1, Math.min(limitRaw, this.maxLimit));
    const page = Math.max(1, query.page ?? 1);
    const offset = (page - 1) * limit;

    const scopePredicate = await this.resolveScopePredicate(accessCtx);
    const where = withScope(this.table, scopePredicate);

    const rows = (await this.database.db
      .select()
      .from(this.table as PgTable)
      .where(where)
      .limit(limit)
      .offset(offset)) as Row[];

    const [totalRow] = (await this.database.db
      .select({ total: count() })
      .from(this.table as PgTable)
      .where(where)) as [{ total: number | string } | undefined];

    const total = Number(totalRow?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return { data: rows, meta: { page, limit, total, totalPages } };
  }

  /** Returns the row by id, or null if not found / out of scope. */
  async findOne(
    id: string,
    accessCtx?: DataAccessContext,
  ): Promise<TTable['$inferSelect'] | null> {
    type Row = TTable['$inferSelect'];
    const scopePredicate = await this.resolveScopePredicate(accessCtx);
    const rows = (await this.database.db
      .select()
      .from(this.table as PgTable)
      .where(withScope(this.table, scopePredicate, eq(this.table.id, id)))
      .limit(1)) as Row[];
    return rows[0] ?? null;
  }

  /** Returns the row by id; throws NotFoundException if not found / out of scope. */
  async findOneOrFail(id: string, accessCtx?: DataAccessContext): Promise<TTable['$inferSelect']> {
    const row = await this.findOne(id, accessCtx);
    if (!row) {
      throw new NotFoundException(`${this.options.slug} ${id} not found`);
    }
    return row;
  }

  /**
   * Insert a new row. Emits `options.events.created` (if configured)
   * after the insert commits.
   *
   * `create` is intentionally NOT scope-gated: the row doesn't exist yet,
   * so its anchor columns aren't set, so a scope predicate has nothing to
   * match against. Permission to create is the controller's
   * `<slug>.create` check, not a row predicate. Consumers that need a
   * pre-create invariant (singletons, FK-existence, etc.) wrap the call.
   */
  async create(input: TTable['$inferInsert'], actorId: string): Promise<TTable['$inferSelect']> {
    type Row = TTable['$inferSelect'];
    const [created] = (await this.database.db
      .insert(this.table as PgTable)
      .values(input as never)
      .returning()) as [Row];

    if (this.options.events?.created) {
      const created_id = (created as { id: string }).id;
      this.events.emitDynamic(this.options.events.created, {
        entityType: this.options.slug,
        entityId: created_id,
        actorId,
        payload: created as Record<string, unknown>,
      });
    }

    return created;
  }

  /**
   * Update a row by id. Reads before-state for the event payload, then
   * applies the patch within scope. The scope predicate is included in
   * BOTH the pre-read AND the UPDATE statement's WHERE — closing the race
   * where a row's scope state could change between the two. Emits
   * `options.events.updated` (if configured) carrying { before, after }.
   */
  async update(
    id: string,
    patch: Partial<TTable['$inferInsert']>,
    actorId: string,
    accessCtx?: DataAccessContext,
  ): Promise<TTable['$inferSelect']> {
    type Row = TTable['$inferSelect'];
    const before = await this.findOneOrFail(id, accessCtx);
    const scopePredicate = await this.resolveScopePredicate(accessCtx);

    const [updated] = (await this.database.db
      .update(this.table as PgTable)
      .set(patch as never)
      .where(withScope(this.table, scopePredicate, eq(this.table.id, id)))
      .returning()) as [Row];

    if (!updated) {
      // Scope changed between read and write — extremely rare; treat as
      // not-found to avoid leaking stale info to the caller.
      throw new NotFoundException(`${this.options.slug} ${id} not found`);
    }

    if (this.options.events?.updated) {
      this.events.emitDynamic(this.options.events.updated, {
        entityType: this.options.slug,
        entityId: id,
        actorId,
        payload: { before, after: updated },
      });
    }

    return updated;
  }

  /**
   * Soft-delete a row by id. Sets `deletedAt`/`deletedBy` (the table
   * MUST have these columns — `withScope` will silently filter the row
   * back out if they're missing). The scope predicate is included in the
   * UPDATE statement's WHERE (mirroring `update`) so an out-of-scope
   * caller cannot tombstone a row even by guessing the id. Emits
   * `options.events.deleted` (if configured).
   */
  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext): Promise<void> {
    const before = await this.findOneOrFail(id, accessCtx);
    const scopePredicate = await this.resolveScopePredicate(accessCtx);

    await this.database.db
      .update(this.table as PgTable)
      .set({ deletedAt: new Date(), deletedBy: actorId } as never)
      .where(withScope(this.table, scopePredicate, eq(this.table.id, id)));

    if (this.options.events?.deleted) {
      this.events.emitDynamic(this.options.events.deleted, {
        entityType: this.options.slug,
        entityId: id,
        actorId,
        payload: before as Record<string, unknown>,
      });
    }
  }
}

/**
 * Build a NestJS provider that wires a per-entity `BaseCrudService`
 * instance under the given DI token. Consumers `@Inject(token)` to receive
 * the configured instance.
 *
 * The token convention is `'CRUD_<slug>'` to mirror the existing
 * `'ENTITY_SERVICE_<entityType>'` pattern compliance already uses for the
 * (deprecating) entity-engine path.
 */
export function createCrudProvider<T extends TableWithId>(
  token: string,
  table: T,
  options: BaseCrudOptions,
): Provider {
  return {
    provide: token,
    useFactory: (
      database: DatabaseService,
      events: DomainEventEmitter,
      dataAccessScope: DataAccessScopeService,
      appLogger: AppLoggerService,
    ) => new BaseCrudService(table, options, database, events, dataAccessScope, appLogger),
    inject: [DatabaseService, DomainEventEmitter, DataAccessScopeService, AppLoggerService],
  };
}
