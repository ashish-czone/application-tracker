import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { BaseCrudService } from '@packages/crud-base';
import { buildListQuery } from '@packages/query-builder';
import type { DataAccessContext } from '@packages/rbac';
import { organizations } from './organizations.schema';
import { ORGANIZATIONS_CRUD_TOKEN } from './organizations.crud-token';
import type {
  CreateOrganizationDto,
  OrganizationsListQuery,
  UpdateOrganizationDto,
} from './organizations.dto';

/**
 * Whitelisted columns for the list endpoint's structured `filters` JSON
 * and bare passthrough id filters. Organizations is a singleton — most
 * filter dimensions are pointless — but the identity columns the
 * frontend may legitimately query (`?id=…`) are kept here so a stale
 * client doesn't 400 and so the bare-passthrough channel works.
 */
const FILTERABLE_ORGANIZATION_COLUMNS = {
  id: organizations.id,
  name: organizations.name,
} as const;

/**
 * Whitelisted sort keys. Singleton means sort almost never matters in
 * practice, but the helper requires a non-empty whitelist when callers
 * want a stable default sort. `name` ASC matches the prior implicit
 * ordering BaseCrudService.list produced (no explicit ORDER BY → DB
 * choice; we anchor it explicitly).
 */
const SORTABLE_ORGANIZATION_COLUMNS = {
  name: organizations.name,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt,
} as const;

/**
 * Organizations is a singleton: exactly one row may exist and the row cannot
 * be deleted. Both invariants live here as explicit method bodies.
 *
 * Composition with `BaseCrudService` (no inheritance) — `crud` is injected
 * under a per-entity DI token wired in `organizations.module.ts` via
 * `createCrudProvider`. The standard findOne/update flows are thin
 * delegate methods; create/softDelete carry the singleton logic; list
 * bypasses the base to apply the `buildListQuery` helper for proper SQL
 * `count()` meta.total parity with the rest of compliance.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATIONS_CRUD_TOKEN)
    private readonly crud: BaseCrudService<typeof organizations>,
    private readonly database: DatabaseService,
  ) {}

  /**
   * Server-paginated list with structured filters JSON, bare-id
   * passthrough (`?id=…`), whitelisted sort, and a SQL `count()` for
   * `meta.total`.
   *
   * Bypasses `BaseCrudService.list` — the base reports
   * `total = rows.length` (the page size) which is wrong even for a
   * singleton (`limit=1` page returns total=1, but if a future seed
   * race ever produced two rows on the same deployment, the wrong
   * total would silently truncate the second). The fix is structural,
   * not opportunistic: the same `buildListQuery` shape every other
   * compliance list endpoint uses.
   *
   * Organizations has no row-level actor-scope (firm-wide singleton;
   * permission scope is `'all'`), so no `scopePredicate` is built.
   * `accessCtx` is accepted for forward-compat with the controller
   * signature but not consumed.
   */
  async list(query: OrganizationsListQuery, accessCtx?: DataAccessContext) {
    void accessCtx; // reserved for future actor-scope; today organizations is firm-wide

    const built = buildListQuery(organizations, query, {
      filterableColumns: FILTERABLE_ORGANIZATION_COLUMNS,
      sortableColumns: SORTABLE_ORGANIZATION_COLUMNS,
      defaultSort: { field: 'name', order: 'asc' },
      includeDeleted: query.includeDeleted,
    });

    const rows = await this.database.db
      .select()
      .from(organizations)
      .where(built.where)
      .orderBy(...built.orderBy)
      .limit(built.limit)
      .offset(built.offset);

    const [totalRow] = await this.database.db
      .select({ total: count() })
      .from(organizations)
      .where(built.where);

    return {
      data: rows,
      meta: built.paginationMeta(Number(totalRow?.total ?? 0)),
    };
  }

  findOneOrFail(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  /**
   * Singleton invariant: reject create when any row already exists. The
   * caller-facing message points them at update so the API remains
   * discoverable from the error.
   */
  async create(input: CreateOrganizationDto, actorId: string) {
    const [{ count: rowCount }] = await this.database.db
      .select({ count: count() })
      .from(organizations);
    if (rowCount > 0) {
      throw new BadRequestException(
        'Organization is a singleton — only one row may exist. Update the existing one instead.',
      );
    }
    return this.crud.create(input as never, actorId);
  }

  update(
    id: string,
    input: UpdateOrganizationDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  /**
   * Hard-block delete — organizations is a singleton; the row represents
   * the deployment's identity and cannot be removed. Throw regardless of
   * id or access context so the failure is unambiguous.
   */
  async softDelete(_id: string, _actorId: string, _accessCtx?: DataAccessContext): Promise<never> {
    throw new BadRequestException('The organization record cannot be deleted.');
  }
}
