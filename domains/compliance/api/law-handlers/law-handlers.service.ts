import { Inject, Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DatabaseService, and, eq, isNull, sql } from '@packages/database';
import { BaseCrudService } from '@packages/crud-base';
import { buildListQuery } from '@packages/query-builder';
import { type DataAccessContext, DataAccessScopeService } from '@packages/rbac';
import { LawsService } from '../laws';
import { complianceLawHandlers } from './law-handlers.schema';
import { LAW_HANDLERS_CRUD_TOKEN } from './law-handlers.crud-token';
import { LAW_HANDLERS_ANCHORS } from './law-handlers.scope';
import type {
  CreateLawHandlerDto,
  LawHandlersListQuery,
  UpdateLawHandlerDto,
} from './law-handlers.dto';

export interface LawHandler {
  id: string;
  lawId: string;
  orgEntityId: string;
  clientId: string | null;
  isPrimary: boolean;
}

export interface CreateLawHandlerInput {
  lawId: string;
  orgEntityId: string;
  clientId?: string | null;
  isPrimary?: boolean;
}

/**
 * Whitelisted columns for the list endpoint's structured `filters`
 * JSON and bare passthrough id filters. Anything outside this map is
 * silently dropped — the frontend cannot push arbitrary column
 * predicates through. `orgEntityId` is the load-bearing entry: PR-7's
 * per-unit panel paginates `?orgEntityId=…` and was previously
 * dropped silently by `BaseCrudService.list`.
 */
const FILTERABLE_LAW_HANDLER_COLUMNS = {
  id: complianceLawHandlers.id,
  lawId: complianceLawHandlers.lawId,
  orgEntityId: complianceLawHandlers.orgEntityId,
  clientId: complianceLawHandlers.clientId,
  isPrimary: complianceLawHandlers.isPrimary,
} as const;

/**
 * Whitelisted sort keys. Anything outside this map falls back to the
 * `defaultSort` registered with `buildListQuery` (`createdAt` DESC).
 */
const SORTABLE_LAW_HANDLER_COLUMNS = {
  isPrimary: complianceLawHandlers.isPrimary,
  createdAt: complianceLawHandlers.createdAt,
  updatedAt: complianceLawHandlers.updatedAt,
} as const;

/**
 * Merged service: CRUD delegates for the entity engine + the programmatic
 * query/insert helpers used by seeds and by the rules service (for default-
 * handler checks).
 *
 * CRUD methods go through the engine (events + audit fire). The
 * `createHandler` / `deleteHandler` programmatic methods skip those side
 * effects — they're for deterministic seeding and structural pivot edits.
 */
@Injectable()
export class LawHandlersService {
  constructor(
    @Inject(LAW_HANDLERS_CRUD_TOKEN)
    private readonly crud: BaseCrudService<typeof complianceLawHandlers>,
    private readonly database: DatabaseService,
    private readonly lawsService: LawsService,
    private readonly dataAccessScope: DataAccessScopeService,
  ) {}

  // ---- CRUD delegates -------------------------------------------------------

  /**
   * Server-paginated list with structured filters JSON, bare passthrough
   * id filters (`?orgEntityId=…`, `?lawId=…`, `?clientId=…`,
   * `?isPrimary=…`), whitelisted sort, and a SQL `count()` for
   * `meta.total`. Each row gets `lawCode` / `lawName` / `lawJurisdiction`
   * embedded via service composition with `LawsService.findDisplayByIds`
   * — same pattern as `ComplianceFilingsService.list`, never a JOIN
   * (laws is intra-domain but treated like compliance-filings does for
   * consistency).
   *
   * Bypasses `BaseCrudService.list` because the base is by design a
   * trivial pagination wrapper that drops filters and reports
   * `total = rows.length` (the page size, not the table count). The
   * `buildListQuery` helper composes search + sort + filters + scope
   * into one WHERE that is reused for the count query so the rendered
   * page and the reported total always agree.
   *
   * Closes the silent-filter gap PR-7's per-unit panel shipped with:
   * the panel paginates `?orgEntityId=…` against this endpoint, so
   * dropping the filter showed handlers from ALL org units. Once this
   * fix lands the panel renders correctly with no frontend change.
   *
   * Actor-scope: `LAW_HANDLERS_ANCHORS` registers `team` (orgEntityId)
   * for forward-compat. No current role grant uses a non-`'any'` scope
   * on `law-handlers.read`, so the predicate is dormant today; the
   * helper ANDs it through unchanged when a future grant lights it up.
   */
  async list(query: LawHandlersListQuery, accessCtx?: DataAccessContext) {
    const scopePredicate = accessCtx
      ? await this.dataAccessScope.buildPredicate(accessCtx, {
          anchors: LAW_HANDLERS_ANCHORS,
        })
      : undefined;

    const built = buildListQuery(complianceLawHandlers, query, {
      scopePredicate,
      filterableColumns: FILTERABLE_LAW_HANDLER_COLUMNS,
      sortableColumns: SORTABLE_LAW_HANDLER_COLUMNS,
      // No free-text columns on this pivot — search is unsupported. The
      // helper treats `searchableColumns: undefined` as a no-op.
      defaultSort: { field: 'createdAt', order: 'desc' },
      includeDeleted: query.includeDeleted,
    });

    const rows = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(built.where)
      .orderBy(...built.orderBy)
      .limit(built.limit)
      .offset(built.offset);

    const [totalRow] = await this.database.db
      .select({ total: count() })
      .from(complianceLawHandlers)
      .where(built.where);

    const meta = built.paginationMeta(Number(totalRow?.total ?? 0));

    // Embed law display fields per row via service composition (no JOIN).
    const lawIds = new Set<string>();
    for (const row of rows as Record<string, unknown>[]) {
      const id = row.lawId;
      if (typeof id === 'string' && id.length > 0) lawIds.add(id);
    }
    if (lawIds.size === 0) {
      return { data: rows, meta };
    }

    const laws = await this.lawsService.findDisplayByIds([...lawIds]);
    const byId = new Map(laws.map((l) => [l.id, l]));

    return {
      data: (rows as Record<string, unknown>[]).map((row) => {
        const lawId = typeof row.lawId === 'string' ? row.lawId : null;
        const law = lawId ? byId.get(lawId) : undefined;
        if (!law) return row;
        return {
          ...row,
          lawCode: law.code,
          lawName: law.name,
          lawJurisdiction: law.jurisdiction,
        };
      }),
      meta,
    };
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  create(input: CreateLawHandlerDto, actorId: string) {
    return this.crud.create(input as never, actorId);
  }

  update(id: string, input: UpdateLawHandlerDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }

  // ---- Programmatic / specialized ------------------------------------------

  async createHandler(input: CreateLawHandlerInput): Promise<LawHandler> {
    const [row] = await this.database.db
      .insert(complianceLawHandlers)
      .values({
        lawId: input.lawId,
        orgEntityId: input.orgEntityId,
        clientId: input.clientId ?? null,
        isPrimary: input.isPrimary ?? false,
      })
      .returning();
    return this.toHandler(row);
  }

  async deleteHandler(id: string): Promise<void> {
    await this.database.db.delete(complianceLawHandlers).where(eq(complianceLawHandlers.id, id));
  }

  async findByLaw(lawId: string): Promise<LawHandler[]> {
    const rows = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.lawId, lawId));
    return rows.map((r) => this.toHandler(r));
  }

  /**
   * A "default handler" is a global handler (client_id IS NULL) for the law.
   * At least one is required before a rule can be created — otherwise task
   * generation for clients with no per-client override would fail at assignee
   * resolution time.
   */
  async hasDefaultHandler(lawId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceLawHandlers)
      .where(and(eq(complianceLawHandlers.lawId, lawId), isNull(complianceLawHandlers.clientId)));
    return (row?.count ?? 0) > 0;
  }

  private toHandler(row: typeof complianceLawHandlers.$inferSelect): LawHandler {
    return {
      id: row.id,
      lawId: row.lawId,
      orgEntityId: row.orgEntityId,
      clientId: row.clientId,
      isPrimary: row.isPrimary,
    };
  }
}
