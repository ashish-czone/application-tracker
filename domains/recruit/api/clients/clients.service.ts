import { ConflictException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DatabaseService,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type DrizzleTx,
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
import { ScopeResolverRegistry, type DataAccessContext } from '@packages/rbac';
import { DomainEventEmitter } from '@packages/events';
import { LookupResolverService, type CustomLookupResolver, type LookupResult } from '@packages/entity-engine';
import type { PaginatedResponse } from '@packages/common';
import type { CreateClientDto, UpdateClientDto } from './clients.dto';
import { clients } from './schema/clients';

/** Subset of `BaseListQuery` we read directly. Not imported from
 *  entity-engine so the service has no dep on the engine for read paths. */
interface ClientsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

const SORTABLE = {
  clientName: sql`coalesce(${companies.name}, ${clients.clientName})`,
  industry: sql`coalesce(${companies.industry}, ${clients.industry})`,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
} as const;

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(
    private readonly database: DatabaseService,
    private readonly companies: CompaniesService,
    private readonly scopeResolvers: ScopeResolverRegistry,
    private readonly events: DomainEventEmitter,
    private readonly lookupResolver: LookupResolverService,
  ) {}

  /**
   * Register a custom lookup resolver for `clients` so other entities
   * (contacts, job_openings, interviews) can search and resolve client labels
   * via the canonical identity in `directory.companies` instead of the
   * (now-shadow-only) `recruit_clients.client_name` column. Replaces any
   * resolver the engine auto-registered from `EntityConfig.lookup`.
   */
  onModuleInit(): void {
    this.lookupResolver.registerResolver('clients', this.buildLookupResolver());
  }

  private buildLookupResolver(): CustomLookupResolver {
    const labelExpr = sql<string>`coalesce(${companies.name}, ${clients.clientName})`;

    return {
      search: async (query, limit): Promise<LookupResult[]> => {
        const term = `%${query}%`;
        const rows = await this.database.db
          .select({ label: labelExpr, value: clients.id })
          .from(clients)
          .leftJoin(companies, eq(clients.companyId, companies.id))
          .where(and(isNull(clients.deletedAt), ilike(labelExpr, term)))
          .limit(limit);
        return rows.map(r => ({ label: String(r.label ?? ''), value: String(r.value ?? '') }));
      },

      getLabel: async (value) => {
        const [row] = await this.database.db
          .select({ label: labelExpr })
          .from(clients)
          .leftJoin(companies, eq(clients.companyId, companies.id))
          .where(eq(clients.id, value))
          .limit(1);
        return row ? String(row.label ?? '') : null;
      },

      getBatchLabels: async (values) => {
        const rows = await this.database.db
          .select({ id: clients.id, label: labelExpr })
          .from(clients)
          .leftJoin(companies, eq(clients.companyId, companies.id))
          .where(inArray(clients.id, values));
        const result = new Map<string, string>();
        for (const row of rows) {
          result.set(String(row.id), String(row.label ?? ''));
        }
        return result;
      },
    };
  }

  // ---------------------------------------------------------------------------
  // READS
  // ---------------------------------------------------------------------------

  async list(
    query: ClientsListQuery,
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

  // ---------------------------------------------------------------------------
  // WRITES
  // ---------------------------------------------------------------------------

  async create(input: CreateClientDto, actorId: string) {
    const inserted = await this.database.db.transaction(async (tx) => {
      const company = await this.companies.findOrCreate(
        toFindOrCreateCompany(input),
        actorId,
        tx,
      );
      const id = randomUUID();
      const now = new Date();
      const [row] = await tx
        .insert(clients)
        .values({
          id,
          companyId: company.id,
          // Shadow columns retained until F-2c. Reads source clientName /
          // website / industry from companies via JOIN; writes still
          // populate the local copies so older readers see them.
          clientName: input.clientName,
          website: input.website ?? null,
          industry: input.industry ?? null,
          contactNumber: input.contactNumber ?? null,
          about: input.about ?? null,
          source: input.source ?? 'added-by-user',
          billingStreet: input.billingStreet ?? null,
          billingCity: input.billingCity ?? null,
          billingProvince: input.billingProvince ?? null,
          billingCode: input.billingCode ?? null,
          billingCountry: input.billingCountry ?? null,
          shippingStreet: input.shippingStreet ?? null,
          shippingCity: input.shippingCity ?? null,
          shippingProvince: input.shippingProvince ?? null,
          shippingCode: input.shippingCode ?? null,
          shippingCountry: input.shippingCountry ?? null,
          createdBy: actorId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });

    // Emit after commit. AuditListener picks this up via the registration
    // entity-engine's defineEntity() set up; the snapshot uses findOne so
    // identity fields are JOIN-projected from directory.companies — i.e.
    // the canonical values, not local shadows.
    const snapshot = await this.findOne(inserted.id);
    this.events.emitDynamic('clients.Created', {
      entityType: 'clients',
      entityId: inserted.id,
      actorId,
      payload: { after: snapshot },
    });

    return inserted;
  }

  async update(
    id: string,
    input: UpdateClientDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    // Scope-check + capture before snapshot. findOne throws NotFound if the
    // row is outside the actor's scope or doesn't exist.
    const before = await this.findOne(id, accessCtx);

    const updated = await this.database.db.transaction(async (tx) => {
      // Sync identity fields to directory.companies first, so a unique
      // violation aborts the whole transaction before we touch recruit_clients.
      const currentCompanyId = (before.companyId as string | null) ?? null;
      const companyPatch = toCompanyPatch(input);
      if (currentCompanyId && Object.keys(companyPatch).length > 0) {
        try {
          await this.companies.update(currentCompanyId, companyPatch, actorId, tx);
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

      const patch = toClientPatch(input);
      patch.updatedAt = new Date();

      const [row] = await tx
        .update(clients)
        .set(patch)
        .where(eq(clients.id, id))
        .returning();
      return row;
    });

    if (!updated) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const after = await this.findOne(id);
    const changes = diffSnapshots(before, after);
    if (changes.length > 0) {
      this.events.emitDynamic('clients.Updated', {
        entityType: 'clients',
        entityId: id,
        actorId,
        payload: { before, after, changes },
      });
    }

    return updated;
  }

  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    const before = await this.findOne(id, accessCtx);

    await this.database.db
      .update(clients)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(clients.id, id));

    this.events.emitDynamic('clients.Deleted', {
      entityType: 'clients',
      entityId: id,
      actorId,
      payload: { before },
    });
  }

  async clone(id: string, actorId: string) {
    // Clone preserves the same companyId — same identity, new commercial
    // relationship. Recruit-specific fields are copied; audit/system
    // columns are regenerated by create().
    const source = await this.findOne(id);
    return this.create(
      {
        clientName: source.clientName as string,
        website: (source.website as string | null) ?? undefined,
        industry: (source.industry as string | null) ?? undefined,
        contactNumber: (source.contactNumber as string | null) ?? undefined,
        about: (source.about as string | null) ?? undefined,
        source: (source.source as string | null) ?? undefined,
        billingStreet: (source.billingStreet as string | null) ?? undefined,
        billingCity: (source.billingCity as string | null) ?? undefined,
        billingProvince: (source.billingProvince as string | null) ?? undefined,
        billingCode: (source.billingCode as string | null) ?? undefined,
        billingCountry: (source.billingCountry as string | null) ?? undefined,
        shippingStreet: (source.shippingStreet as string | null) ?? undefined,
        shippingCity: (source.shippingCity as string | null) ?? undefined,
        shippingProvince: (source.shippingProvince as string | null) ?? undefined,
        shippingCode: (source.shippingCode as string | null) ?? undefined,
        shippingCountry: (source.shippingCountry as string | null) ?? undefined,
      } as CreateClientDto,
      actorId,
    );
  }

  async restore(id: string) {
    const [row] = await this.database.db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Client not found');
    }

    await this.database.db
      .update(clients)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(clients.id, id));

    return this.findOne(id);
  }

  /**
   * Picker bridge for hand-written entities that show a companies picker
   * but persist a recruit_client.id FK. Returns the existing recruit_client
   * for this company, or creates a minimal one (companyId only, no
   * commercial sidecar yet) if none exists. Used by F-2c when contacts /
   * job_openings / interviews route their clientId picker through
   * companies search.
   */
  async findOrCreateForCompany(
    companyId: string,
    actorId: string,
    externalTx?: DrizzleTx,
  ): Promise<{ id: string; created: boolean }> {
    const exec = externalTx ?? this.database.db;
    const [existing] = await exec
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
      .limit(1);
    if (existing) return { id: existing.id, created: false };

    const [company] = await exec
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const id = randomUUID();
    const now = new Date();
    await exec.insert(clients).values({
      id,
      companyId,
      clientName: company.name,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    this.events.emitDynamic('clients.Created', {
      entityType: 'clients',
      entityId: id,
      actorId,
      payload: { after: { id, companyId, clientName: company.name, createdBy: actorId } },
    });

    return { id, created: true };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

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

  private resolveSort(query: ClientsListQuery) {
    const key = (query.sort as keyof typeof SORTABLE) ?? 'clientName';
    const expr = SORTABLE[key] ?? SORTABLE.clientName;
    return query.order === 'desc' ? desc(expr) : asc(expr);
  }

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

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

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

/** Project the patch onto recruit_clients columns. Identity fields are
 *  written here too (shadow columns) until F-2c. */
function toClientPatch(input: UpdateClientDto): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of [
    'clientName', 'website', 'industry',
    'contactNumber', 'about', 'source',
    'billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry',
    'shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry',
  ] as const) {
    if (input[key] !== undefined) {
      patch[key] = input[key] === null || input[key] === '' ? null : input[key];
    }
  }
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

const DIFFABLE_KEYS = [
  'clientName', 'website', 'industry', 'contactNumber', 'about', 'source',
  'billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry',
  'shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry',
] as const;

function diffSnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const key of DIFFABLE_KEYS) {
    if (before[key] !== after[key]) changed.push(key);
  }
  return changed;
}
