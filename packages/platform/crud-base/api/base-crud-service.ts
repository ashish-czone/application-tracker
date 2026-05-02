import { Injectable, NotFoundException, type Provider } from '@nestjs/common';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { DataAccessContext } from '@packages/rbac';
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
 *   - **Actor-scope predicates** — every method accepts
 *     `accessCtx?: DataAccessContext` in its signature, but the base does
 *     NOT yet wire the context to a scope predicate. Consumers with row-
 *     level RBAC needs call `DataAccessScopeService.buildPredicate(ctx)`
 *     themselves and apply it inline.
 *
 * @example
 *   // module: provide one BaseCrudService instance per entity behind a token
 *   providers: [
 *     createCrudProvider('CRUD_organizations', organizations, {
 *       slug: 'organizations',
 *       events: { created: 'organizations.Created', ... },
 *     }),
 *     OrganizationsService,
 *   ]
 *
 *   // service: inject and delegate per method
 *   @Injectable()
 *   export class OrganizationsService {
 *     constructor(
 *       @Inject('CRUD_organizations')
 *       private readonly crud: BaseCrudService<typeof organizations>,
 *     ) {}
 *
 *     async list(query, ctx?) { return this.crud.list(query, ctx); }
 *     async findOneOrFail(id, ctx?) { return this.crud.findOneOrFail(id, ctx); }
 *     async create(input, actorId) {
 *       // singleton invariant — explicit, lives here, not in the base
 *       if (await this.exists()) throw new BadRequestException('singleton');
 *       return this.crud.create(input, actorId);
 *     }
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
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(`BaseCrudService:${options.slug}`);
    this.defaultLimit = options.defaultLimit ?? 25;
    this.maxLimit = options.maxLimit ?? 100;
  }

  /**
   * List rows with pagination. Applies tenant + soft-delete scope via
   * `withScope`. Does NOT apply actor-scope (apply manually in the
   * consumer's own `list` method when needed). Search/sort/structured
   * filters are not implemented in the base — consumers compose their own
   * `list` and call this only for the trivial pagination case.
   */
  async list(
    query: BaseListQuery = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _accessCtx?: DataAccessContext,
  ): Promise<{ data: TTable['$inferSelect'][]; meta: { page: number; limit: number; total: number } }> {
    type Row = TTable['$inferSelect'];
    const limitRaw = query.limit ?? this.defaultLimit;
    const limit = Math.max(1, Math.min(limitRaw, this.maxLimit));
    const page = Math.max(1, query.page ?? 1);
    const offset = (page - 1) * limit;

    const rows = (await this.database.db
      .select()
      .from(this.table as PgTable)
      .where(withScope(this.table))
      .limit(limit)
      .offset(offset)) as Row[];

    // Total count is intentionally not computed in the base — most
    // consumers want it but the signature varies (full count vs estimate
    // vs none). Consumers compose their own list to add a count query.
    return { data: rows, meta: { page, limit, total: rows.length } };
  }

  /** Returns the row by id, or null if not found / out of scope. */
  async findOne(
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _accessCtx?: DataAccessContext,
  ): Promise<TTable['$inferSelect'] | null> {
    type Row = TTable['$inferSelect'];
    const rows = (await this.database.db
      .select()
      .from(this.table as PgTable)
      .where(withScope(this.table, eq(this.table.id, id)))
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
   * applies the patch within scope. Emits `options.events.updated` (if
   * configured) carrying { before, after }.
   */
  async update(
    id: string,
    patch: Partial<TTable['$inferInsert']>,
    actorId: string,
    accessCtx?: DataAccessContext,
  ): Promise<TTable['$inferSelect']> {
    type Row = TTable['$inferSelect'];
    const before = await this.findOneOrFail(id, accessCtx);

    const [updated] = (await this.database.db
      .update(this.table as PgTable)
      .set(patch as never)
      .where(withScope(this.table, eq(this.table.id, id)))
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
   * back out if they're missing). Emits `options.events.deleted` (if
   * configured).
   */
  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext): Promise<void> {
    const before = await this.findOneOrFail(id, accessCtx);

    await this.database.db
      .update(this.table as PgTable)
      .set({ deletedAt: new Date(), deletedBy: actorId } as never)
      .where(withScope(this.table, eq(this.table.id, id)));

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
      appLogger: AppLoggerService,
    ) => new BaseCrudService(table, options, database, events, appLogger),
    inject: [DatabaseService, DomainEventEmitter, AppLoggerService],
  };
}
