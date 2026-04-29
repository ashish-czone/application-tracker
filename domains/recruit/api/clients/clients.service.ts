import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DatabaseService,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from '@packages/database';
import { computePagination, computePaginationMeta } from '@packages/query-builder';
import { buildSoftDeleteCondition } from '@packages/soft-delete';
import {
  CompaniesService,
  companies,
  type FindOrCreateCompanyInput,
  type UpdateCompanyInput,
} from '@packages/directory';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import { ScopeResolverRegistry, type DataAccessContext } from '@packages/rbac';
import type { PaginatedResponse } from '@packages/common';
import type { CreateClientDto, UpdateClientDto } from './clients.dto';
import { clients } from './schema/clients';

const SORTABLE = {
  clientName: sql`coalesce(${companies.name}, ${clients.clientName})`,
  industry: sql`coalesce(${companies.industry}, ${clients.industry})`,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
} as const;

@Injectable()
export class ClientsService {
  constructor(
    @Inject('ENTITY_SERVICE_clients') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly companies: CompaniesService,
    private readonly scopeResolvers: ScopeResolverRegistry,
  ) {}

  async list(
    query: BaseListQuery,
    accessCtx?: DataAccessContext,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { page, limit, offset } = computePagination({
      page: query.page ?? 1,
      limit: query.limit ?? 25,
    });

    const conditions: SQL[] = [];

    const scopeCond = await this.resolveScope(accessCtx);
    if (scopeCond) conditions.push(scopeCond);

    const softDeleteCond = buildSoftDeleteCondition(clients, query.includeDeleted ?? false);
    if (softDeleteCond) conditions.push(softDeleteCond);

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(ilike(sql<string>`coalesce(${companies.name}, ${clients.clientName})`, term));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderExpr = this.resolveSort(query);

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(clients)
      .leftJoin(companies, eq(clients.companyId, companies.id))
      .where(where);

    const rows = await this.database.db
      .select(this.buildSelectMap())
      .from(clients)
      .leftJoin(companies, eq(clients.companyId, companies.id))
      .where(where)
      .orderBy(orderExpr)
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      meta: computePaginationMeta(Number(total), page, limit),
    };
  }

  async findOne(
    id: string,
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const conditions: SQL[] = [eq(clients.id, id)];

    const softDeleteCond = buildSoftDeleteCondition(clients);
    if (softDeleteCond) conditions.push(softDeleteCond);

    const scopeCond = await this.resolveScope(accessCtx);
    if (scopeCond) conditions.push(scopeCond);

    const [row] = await this.database.db
      .select(this.buildSelectMap())
      .from(clients)
      .leftJoin(companies, eq(clients.companyId, companies.id))
      .where(and(...conditions))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Client not found');
    }

    return row;
  }

  async create(input: CreateClientDto, actorId: string) {
    return this.database.db.transaction(async (tx) => {
      const company = await this.companies.findOrCreate(
        toFindOrCreateCompany(input),
        actorId,
        tx,
      );
      return this.entityService.create({ ...input, companyId: company.id }, actorId, tx);
    });
  }

  async update(
    id: string,
    input: UpdateClientDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ companyId: clients.companyId })
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);
      if (!current) {
        throw new NotFoundException(`Client ${id} not found`);
      }

      const companyPatch = toCompanyPatch(input);
      if (current.companyId && Object.keys(companyPatch).length > 0) {
        try {
          await this.companies.update(current.companyId, companyPatch, actorId, tx);
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(
              companyPatch.name
                ? `A company named "${companyPatch.name}" already exists in the directory. Use the Directory merge tool to combine identities.`
                : `Directory uniqueness conflict — use the Directory merge tool to resolve.`,
            );
          }
          throw error;
        }
      }

      return this.entityService.update(id, input, actorId, accessCtx, tx);
    });
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }

  // ---------------------------------------------------------------------------

  /**
   * Project clientName/website/industry from directory.companies (the canonical
   * source after R-2 wired identity into the directory). Local shadow columns
   * stay COALESCE'd in for rows not yet backfilled — they drop in F-2.
   *
   * `contactsCount` and `jobOpeningsCount` are correlated subqueries so the
   * list endpoint stays a single round-trip.
   */
  private buildSelectMap() {
    return {
      id: clients.id,
      companyId: clients.companyId,
      clientName: sql<string>`coalesce(${companies.name}, ${clients.clientName})`.as('clientName'),
      contactNumber: clients.contactNumber,
      website: sql<string | null>`coalesce(${companies.websiteDomain}, ${clients.website})`.as('website'),
      industry: sql<string | null>`coalesce(${companies.industry}, ${clients.industry})`.as('industry'),
      about: clients.about,
      source: clients.source,
      billingStreet: clients.billingStreet,
      billingCity: clients.billingCity,
      billingProvince: clients.billingProvince,
      billingCode: clients.billingCode,
      billingCountry: clients.billingCountry,
      shippingStreet: clients.shippingStreet,
      shippingCity: clients.shippingCity,
      shippingProvince: clients.shippingProvince,
      shippingCode: clients.shippingCode,
      shippingCountry: clients.shippingCountry,
      createdBy: clients.createdBy,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      deletedAt: clients.deletedAt,
      contactsCount: sql<number>`(
        SELECT COUNT(*)::integer FROM "recruit_contacts"
        WHERE "client_id" = ${clients.id} AND "deleted_at" IS NULL
      )`.as('contactsCount'),
      jobOpeningsCount: sql<number>`(
        SELECT COUNT(*)::integer FROM "job_openings"
        WHERE "client_id" = ${clients.id} AND "deleted_at" IS NULL
      )`.as('jobOpeningsCount'),
    };
  }

  private resolveSort(query: BaseListQuery) {
    const key = (query.sort as keyof typeof SORTABLE) ?? 'clientName';
    const expr = SORTABLE[key] ?? SORTABLE.clientName;
    return query.order === 'desc' ? desc(expr) : asc(expr);
  }

  /**
   * Hand-rolled scope resolution: dispatch each scope through
   * `ScopeResolverRegistry` (same registry the engine uses) so 'own',
   * 'assigned', and any future scope kinds work without re-implementing
   * resolvers. Empty scopes deny; `any` short-circuits to unrestricted.
   */
  private async resolveScope(ctx?: DataAccessContext): Promise<SQL | undefined> {
    if (!ctx) return undefined;
    if (ctx.scopes.length === 0) return sql`1=0`;
    if (ctx.scopes.some((s) => s.type === 'any')) return undefined;

    const anchors = { creator: clients.createdBy };
    const predicates: SQL[] = [];
    for (const scope of ctx.scopes) {
      const resolver = this.scopeResolvers.get(scope.type);
      if (!resolver) continue;
      const predicate = await resolver.resolve({ userId: ctx.userId, anchors }, scope.params);
      if (predicate) predicates.push(predicate);
    }

    if (predicates.length === 0) return sql`1=0`;
    if (predicates.length === 1) return predicates[0];
    return or(...predicates)!;
  }
}

function toFindOrCreateCompany(input: CreateClientDto): FindOrCreateCompanyInput {
  return {
    name: input.clientName,
    websiteDomain: normalizeWebsiteDomain(input.website),
    industry: input.industry ?? null,
  };
}

function toCompanyPatch(input: UpdateClientDto): UpdateCompanyInput {
  const patch: UpdateCompanyInput = {};
  if (input.clientName !== undefined) patch.name = input.clientName;
  if (input.website !== undefined) patch.websiteDomain = normalizeWebsiteDomain(input.website);
  if (input.industry !== undefined) patch.industry = input.industry ?? null;
  return patch;
}

function normalizeWebsiteDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.trim();
  return stripped || null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505'
  );
}
