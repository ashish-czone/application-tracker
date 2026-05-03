import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { BaseCrudService, type BaseListQuery } from '@packages/crud-base';
import { DatabaseService, withScope } from '@packages/database';
import type { DataAccessContext } from '@packages/rbac';
import { complianceLaws } from './laws.schema';
import { LAWS_CRUD_TOKEN } from './laws.crud-token';
import type { CreateLawDto, LawsOptionsQuery, UpdateLawDto } from './laws.dto';

export interface LawDisplayFields {
  id: string;
  code: string;
  name: string;
  jurisdiction: string | null;
}

export type LawJurisdiction = 'central' | 'state' | 'municipal' | 'international';

export interface LawTreeNode {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  jurisdiction: LawJurisdiction;
  effectiveFrom: string | null;
  children?: LawTreeNode[];
}

export interface LawTreeResponse {
  tree: LawTreeNode[];
  counts: Record<LawJurisdiction, number>;
}

@Injectable()
export class LawsService {
  constructor(
    @Inject(LAWS_CRUD_TOKEN) private readonly crud: BaseCrudService<typeof complianceLaws>,
    private readonly database: DatabaseService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.crud.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  /**
   * Hierarchical tree of laws + per-jurisdiction counts. The tree is built
   * server-side (`SELECT id, parent_id, …` then build) so the frontend
   * consumes one round-trip instead of fetching a flat `limit:500` page and
   * stitching parents on the client. Counts come from a single GROUP BY so
   * the jurisdiction badge totals reflect the whole dataset, not whatever
   * truncated subset happened to fit on page 1.
   *
   * Optional `jurisdiction` scopes the tree to that bucket (e.g. only
   * `central` laws). Counts are always computed across the unfiltered set so
   * the bucket badges in the UI stay stable as the user changes filters.
   */
  async getTree(params?: { jurisdiction?: LawJurisdiction }): Promise<LawTreeResponse> {
    const filterCondition = params?.jurisdiction
      ? eq(complianceLaws.jurisdiction, params.jurisdiction)
      : undefined;
    const scopeWhere = withScope(complianceLaws);
    const whereClause = filterCondition
      ? withScope(complianceLaws, filterCondition)
      : scopeWhere;

    const flatRowsQuery = this.database.db
      .select({
        id: complianceLaws.id,
        parentId: complianceLaws.parentId,
        code: complianceLaws.code,
        name: complianceLaws.name,
        jurisdiction: complianceLaws.jurisdiction,
        effectiveFrom: complianceLaws.effectiveFrom,
      })
      .from(complianceLaws);
    const flatRows = whereClause
      ? await flatRowsQuery.where(whereClause)
      : await flatRowsQuery;

    const countsResult = await this.database.db.execute(sql`
      SELECT jurisdiction, COUNT(*)::int AS count
      FROM ${complianceLaws}
      ${scopeWhere ? sql`WHERE ${scopeWhere}` : sql``}
      GROUP BY jurisdiction
    `);

    const counts: Record<LawJurisdiction, number> = {
      central: 0,
      state: 0,
      municipal: 0,
      international: 0,
    };
    for (const row of countsResult.rows as Array<{ jurisdiction: string | null; count: number }>) {
      const j = normalizeJurisdiction(row.jurisdiction);
      counts[j] += Number(row.count);
    }

    const tree = buildLawTree(flatRows.map((r) => ({
      id: r.id,
      parentId: r.parentId ?? null,
      code: r.code,
      name: r.name,
      jurisdiction: normalizeJurisdiction(r.jurisdiction),
      effectiveFrom: r.effectiveFrom ?? null,
    })));

    return { tree, counts };
  }

  /**
   * Typeahead options for the law filter dropdown. Returns `{id,code,name}`
   * rows ordered by code (the typical user-facing label). `search` ILIKEs
   * code + name; `ids` (when present) hydrates labels for already-selected
   * chips and bypasses search so a reopened page can show its filter chips
   * even when the saved filter values are off the typeahead's current
   * visible page.
   */
  async getOptions(
    query: LawsOptionsQuery,
    _accessCtx?: DataAccessContext,
  ): Promise<Array<{ id: string; code: string; name: string }>> {
    const conditions: SQL[] = [];
    if (query.ids && query.ids.length > 0) {
      conditions.push(sql`${complianceLaws.id} = ANY(${query.ids}::text[])`);
    } else if (query.search) {
      const escaped = query.search.replace(/[%_\\]/g, (c) => `\\${c}`);
      const pattern = `%${escaped}%`;
      conditions.push(
        sql`(${complianceLaws.code} ILIKE ${pattern} OR ${complianceLaws.name} ILIKE ${pattern})`,
      );
    }
    const rows = await this.database.db
      .select({
        id: complianceLaws.id,
        code: complianceLaws.code,
        name: complianceLaws.name,
      })
      .from(complianceLaws)
      .where(withScope(complianceLaws, ...conditions))
      .orderBy(asc(complianceLaws.code))
      .limit(query.limit);
    return rows;
  }

  /**
   * Batch-fetch display columns for a set of law IDs. Used by other compliance
   * services that surface law metadata (code, jurisdiction) alongside their
   * own list responses. Soft-delete + tenant-scoped via `withScope`. Returns
   * rows in unspecified order — caller maps by id.
   */
  async findDisplayByIds(ids: readonly string[]): Promise<LawDisplayFields[]> {
    if (ids.length === 0) return [];
    return this.database.db
      .select({
        id: complianceLaws.id,
        code: complianceLaws.code,
        name: complianceLaws.name,
        jurisdiction: complianceLaws.jurisdiction,
      })
      .from(complianceLaws)
      .where(withScope(complianceLaws, inArray(complianceLaws.id, ids as string[])));
  }

  create(input: CreateLawDto, actorId: string) {
    return this.crud.create(input as never, actorId);
  }

  update(id: string, input: UpdateLawDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }
}

const VALID_JURISDICTIONS: ReadonlySet<LawJurisdiction> = new Set([
  'central',
  'state',
  'municipal',
  'international',
]);

function normalizeJurisdiction(value: string | null | undefined): LawJurisdiction {
  if (typeof value === 'string' && (VALID_JURISDICTIONS as ReadonlySet<string>).has(value)) {
    return value as LawJurisdiction;
  }
  return 'central';
}

/**
 * Build a hierarchy from a flat list. Records whose parent is missing from
 * the input surface at the root so nothing is silently lost.
 */
function buildLawTree(rows: ReadonlyArray<Omit<LawTreeNode, 'children'>>): LawTreeNode[] {
  const byId = new Map<string, LawTreeNode>();
  for (const row of rows) {
    byId.set(row.id, { ...row });
  }
  const roots: LawTreeNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    if (row.parentId && byId.has(row.parentId)) {
      const parent = byId.get(row.parentId)!;
      (parent.children ??= []).push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
