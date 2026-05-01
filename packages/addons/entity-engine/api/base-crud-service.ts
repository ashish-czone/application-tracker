import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { BaseListQuery } from './types';

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
 * Constraint for tables that BaseCrudService can manage. The table must
 * expose an `id` column (UUID text). Other columns are open.
 */
type TableWithId = PgTable & { id: PgColumn };

/**
 * Class factory: returns an injectable abstract class with standard CRUD
 * methods typed for the given Drizzle table. Subclass to add custom methods,
 * or use directly via DI for entities that only need the standard 5
 * (list/findOne/create/update/softDelete).
 *
 * Composes:
 *   - `withScope(table, …)` for tenant + soft-delete scoping (no-op on tables
 *     without those columns)
 *   - Optional event emission on create/update/softDelete (configured via
 *     `options.events`)
 *   - Logger context bound to `options.slug`
 *
 * Does NOT compose (intentionally — each is the consumer's job):
 *   - **Workflow transitions** — call `WorkflowEngineService` directly from a
 *     subclass method
 *   - **Lookup hydration** — query lookup tables explicitly in your custom
 *     read methods
 *   - **Permission checks** — controllers handle via `@RequirePermission`
 *   - **Validation** — controllers handle via `Schema.parse(body)`
 *   - **Actor-scope predicates** — apply manually via `DataAccessScopeService`
 *     when an entity needs row-level RBAC. (A future iteration may compose
 *     this in via `options.scoping: 'tenant+actor'` once the consumer pattern
 *     is established.)
 *
 * @example
 *   // organizations.service.ts
 *   import { BaseCrudService } from '@packages/entity-engine';
 *   import { organizations } from './organizations.schema';
 *
 *   @Injectable()
 *   export class OrganizationsService extends BaseCrudService(organizations, {
 *     slug: 'organizations',
 *   }) {
 *     // Inherits list/findOne/create/update/softDelete typed for `organizations`.
 *   }
 *
 * Subclasses with extra constructor deps must declare an explicit constructor
 * and forward the inherited deps via super():
 *
 * @example
 *   @Injectable()
 *   export class ClientsService extends BaseCrudService(clients, { slug: 'clients' }) {
 *     constructor(
 *       database: DatabaseService,
 *       events: DomainEventEmitter,
 *       appLogger: AppLoggerService,
 *       private readonly contacts: ClientContactsService,
 *     ) {
 *       super(database, events, appLogger);
 *     }
 *   }
 */
export function BaseCrudService<TTable extends TableWithId>(
  table: TTable,
  options: BaseCrudOptions,
) {
  type Row = TTable['$inferSelect'];
  type Insert = TTable['$inferInsert'];
  type Update = Partial<Insert>;

  const defaultLimit = options.defaultLimit ?? 25;
  const maxLimit = options.maxLimit ?? 100;

  @Injectable()
  abstract class BaseCrudServiceImpl {
    protected readonly logger: ContextLogger;

    constructor(
      protected readonly database: DatabaseService,
      protected readonly events: DomainEventEmitter,
      appLogger: AppLoggerService,
    ) {
      this.logger = appLogger.forContext(`BaseCrudService:${options.slug}`);
    }

    /**
     * List rows with pagination. Applies tenant + soft-delete scope via
     * `withScope`. Does NOT apply actor-scope (apply manually in subclass
     * if needed). Search/sort/structured-filters are not implemented in the
     * shell — override `list` in the subclass to add them.
     */
    async list(query: BaseListQuery = {}): Promise<{ data: Row[]; meta: { page: number; limit: number; total: number } }> {
      const limitRaw = query.limit ?? defaultLimit;
      const limit = Math.max(1, Math.min(limitRaw, maxLimit));
      const page = Math.max(1, query.page ?? 1);
      const offset = (page - 1) * limit;

      const rows = (await this.database.db
        .select()
        .from(table as PgTable)
        .where(withScope(table))
        .limit(limit)
        .offset(offset)) as Row[];

      // Total count is intentionally not computed in the shell — most
      // consumers want it but the signature varies (full count vs estimate
      // vs none). Subclasses override list to add a count query.
      return { data: rows, meta: { page, limit, total: rows.length } };
    }

    /** Returns the row by id, or null if not found / out of scope. */
    async findOne(id: string): Promise<Row | null> {
      const rows = (await this.database.db
        .select()
        .from(table as PgTable)
        .where(withScope(table, eq(table.id, id)))
        .limit(1)) as Row[];
      return rows[0] ?? null;
    }

    /** Returns the row by id; throws NotFoundException if not found / out of scope. */
    async findOneOrFail(id: string): Promise<Row> {
      const row = await this.findOne(id);
      if (!row) {
        throw new NotFoundException(`${options.slug} ${id} not found`);
      }
      return row;
    }

    /**
     * Insert a new row. Emits `options.events.created` (if configured)
     * after the insert commits.
     */
    async create(input: Insert, actorId: string): Promise<Row> {
      const [created] = (await this.database.db
        .insert(table as PgTable)
        .values(input as never)
        .returning()) as [Row];

      if (options.events?.created) {
        const created_id = (created as { id: string }).id;
        this.events.emitDynamic(options.events.created, {
          entityType: options.slug,
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
    async update(id: string, patch: Update, actorId: string): Promise<Row> {
      const before = await this.findOneOrFail(id);

      const [updated] = (await this.database.db
        .update(table as PgTable)
        .set(patch as never)
        .where(withScope(table, eq(table.id, id)))
        .returning()) as [Row];

      if (!updated) {
        // Scope changed between read and write — extremely rare; treat as
        // not-found to avoid leaking stale info to the caller.
        throw new NotFoundException(`${options.slug} ${id} not found`);
      }

      if (options.events?.updated) {
        this.events.emitDynamic(options.events.updated, {
          entityType: options.slug,
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
    async softDelete(id: string, actorId: string): Promise<void> {
      const before = await this.findOneOrFail(id);

      await this.database.db
        .update(table as PgTable)
        .set({ deletedAt: new Date(), deletedBy: actorId } as never)
        .where(withScope(table, eq(table.id, id)));

      if (options.events?.deleted) {
        this.events.emitDynamic(options.events.deleted, {
          entityType: options.slug,
          entityId: id,
          actorId,
          payload: before as Record<string, unknown>,
        });
      }
    }
  }

  return BaseCrudServiceImpl;
}
