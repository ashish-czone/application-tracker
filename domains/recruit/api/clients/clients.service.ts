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
  type FindOrCreateCompanyInput,
  type UpdateCompanyInput,
} from '@packages/directory';
import { ScopeResolverRegistry, type DataAccessContext } from '@packages/rbac';
import { DomainEventEmitter } from '@packages/events';
import { LookupResolverService, type CustomLookupResolver, type LookupResult } from '@packages/entity-engine';
import type { PaginatedResponse } from '@packages/common';
import type { CreateClientDto, UpdateClientDto } from './clients.dto';
import { clients } from './schema/clients';
import { companies, type RecruitAddress } from './companies-ref';

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
  clientName: companies.name,
  industry: companies.industry,
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
   * via the canonical identity in `directory.companies`.
   */
  onModuleInit(): void {
    this.lookupResolver.registerResolver('clients', this.buildLookupResolver());
  }

  private buildLookupResolver(): CustomLookupResolver {
    return {
      search: async (query, limit): Promise<LookupResult[]> => {
        const term = `%${query}%`;
        const rows = await this.database.db
          .select({ label: companies.name, value: clients.id })
          .from(clients)
          .leftJoin(companies, eq(clients.companyId, companies.id))
          .where(and(isNull(clients.deletedAt), ilike(companies.name, term)))
          .limit(limit);
        return rows.map(r => ({ label: String(r.label ?? ''), value: String(r.value ?? '') }));
      },

      getLabel: async (value) => {
        const [row] = await this.database.db
          .select({ label: companies.name })
          .from(clients)
          .leftJoin(companies, eq(clients.companyId, companies.id))
          .where(eq(clients.id, value))
          .limit(1);
        return row ? String(row.label ?? '') : null;
      },

      getBatchLabels: async (values) => {
        const rows = await this.database.db
          .select({ id: clients.id, label: companies.name })
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
      conditions.push(ilike(companies.name, term));
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

      // Canonical write: companies.recruit_*. The shared row is the recruit
      // client when these fields are set.
      await tx
        .update(companies)
        .set({
          recruitAbout: input.about ?? null,
          recruitContactNumber: input.contactNumber ?? null,
          recruitSource: input.source ?? 'added-by-user',
          recruitBillingAddress: toAddressJsonb(input, 'billing'),
          recruitShippingAddress: toAddressJsonb(input, 'shipping'),
          recruitBecameClientAt: now,
          recruitArchivedAt: null,
        })
        .where(eq(companies.id, company.id));

      // Shadow write to recruit_clients — keeps child-table FKs valid until
      // the FK repoint PR. Same data, flat columns.
      const [row] = await tx
        .insert(clients)
        .values({
          id,
          companyId: company.id,
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
    const before = await this.findOne(id, accessCtx);

    const updated = await this.database.db.transaction(async (tx) => {
      const currentCompanyId = (before.companyId as string | null) ?? null;

      // Identity sync to directory.companies first — unique violation aborts
      // before any sidecar writes.
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

      // Canonical recruit-prefix write on companies. Address jsonb is rebuilt
      // by merging the patch over the previous flat address fields read in
      // `before`, so partial address updates don't clobber unrelated keys.
      if (currentCompanyId) {
        const recruitPatch = toCompanyRecruitPatch(input, before);
        if (Object.keys(recruitPatch).length > 0) {
          await tx
            .update(companies)
            .set(recruitPatch)
            .where(eq(companies.id, currentCompanyId));
        }
      }

      // Shadow write to recruit_clients — same fields, flat columns.
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
    const currentCompanyId = (before.companyId as string | null) ?? null;
    const now = new Date();

    await this.database.db.transaction(async (tx) => {
      if (currentCompanyId) {
        await tx
          .update(companies)
          .set({ recruitArchivedAt: now })
          .where(eq(companies.id, currentCompanyId));
      }
      await tx
        .update(clients)
        .set({ deletedAt: now, deletedBy: actorId })
        .where(eq(clients.id, id));
    });

    this.events.emitDynamic('clients.Deleted', {
      entityType: 'clients',
      entityId: id,
      actorId,
      payload: { before },
    });
  }

  async clone(id: string, actorId: string) {
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
      .select({ id: clients.id, companyId: clients.companyId })
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Client not found');
    }

    await this.database.db.transaction(async (tx) => {
      if (row.companyId) {
        await tx
          .update(companies)
          .set({ recruitArchivedAt: null })
          .where(eq(companies.id, row.companyId));
      }
      await tx
        .update(clients)
        .set({ deletedAt: null, deletedBy: null })
        .where(eq(clients.id, id));
    });

    return this.findOne(id);
  }

  /**
   * Picker bridge for hand-written entities that show a companies picker
   * but persist a recruit_client.id FK. Returns the existing recruit_client
   * for this company, or creates a minimal one if none exists. Stamps
   * `companies.recruit_became_client_at` so the canonical lifecycle marker
   * matches.
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

    await exec
      .update(companies)
      .set({ recruitBecameClientAt: now, recruitArchivedAt: null })
      .where(eq(companies.id, companyId));

    await exec.insert(clients).values({
      id,
      companyId,
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
      clientName: companies.name,
      contactNumber: companies.recruitContactNumber,
      website: companies.websiteDomain,
      industry: companies.industry,
      about: companies.recruitAbout,
      source: companies.recruitSource,
      billingStreet: sql<string | null>`${companies.recruitBillingAddress}->>'street'`.as('billing_street'),
      billingCity: sql<string | null>`${companies.recruitBillingAddress}->>'city'`.as('billing_city'),
      billingProvince: sql<string | null>`${companies.recruitBillingAddress}->>'province'`.as('billing_province'),
      billingCode: sql<string | null>`${companies.recruitBillingAddress}->>'postalCode'`.as('billing_code'),
      billingCountry: sql<string | null>`${companies.recruitBillingAddress}->>'country'`.as('billing_country'),
      shippingStreet: sql<string | null>`${companies.recruitShippingAddress}->>'street'`.as('shipping_street'),
      shippingCity: sql<string | null>`${companies.recruitShippingAddress}->>'city'`.as('shipping_city'),
      shippingProvince: sql<string | null>`${companies.recruitShippingAddress}->>'province'`.as('shipping_province'),
      shippingCode: sql<string | null>`${companies.recruitShippingAddress}->>'postalCode'`.as('shipping_code'),
      shippingCountry: sql<string | null>`${companies.recruitShippingAddress}->>'country'`.as('shipping_country'),
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

/** Project the patch onto recruit_clients flat columns. Identity fields
 *  are routed via `toCompanyPatch`. */
function toClientPatch(input: UpdateClientDto): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of [
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

const BILLING_KEYS = ['billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry'] as const;
const SHIPPING_KEYS = ['shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry'] as const;

/** Build a recruit-prefix patch for the `companies` row from an UpdateClientDto.
 *  Address jsonb is rebuilt by merging the patch over the previous flat address
 *  values read in `before` — partial address updates don't clobber unrelated
 *  keys; clearing all components produces NULL jsonb. */
function toCompanyRecruitPatch(
  input: UpdateClientDto,
  before: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.about !== undefined) patch.recruitAbout = normalizeNullable(input.about);
  if (input.contactNumber !== undefined) patch.recruitContactNumber = normalizeNullable(input.contactNumber);
  if (input.source !== undefined) patch.recruitSource = normalizeNullable(input.source);

  if (BILLING_KEYS.some((k) => input[k] !== undefined)) {
    patch.recruitBillingAddress = mergeAddress(input, before, 'billing');
  }
  if (SHIPPING_KEYS.some((k) => input[k] !== undefined)) {
    patch.recruitShippingAddress = mergeAddress(input, before, 'shipping');
  }

  return patch;
}

/** Build a fresh recruit-address jsonb from a CreateClientDto. */
function toAddressJsonb(
  input: CreateClientDto,
  variant: 'billing' | 'shipping',
): RecruitAddress | null {
  const keys = variant === 'billing' ? BILLING_KEYS : SHIPPING_KEYS;
  const obj: RecruitAddress = {};
  for (const key of keys) {
    const value = input[key];
    if (value !== undefined && value !== null && value !== '') {
      obj[addressJsonbKeyFor(key)] = value;
    }
  }
  return Object.keys(obj).length === 0 ? null : obj;
}

/** Merge a partial address patch over the previous flat address values from
 *  `before`. Returns null if the merged jsonb has no non-empty keys. */
function mergeAddress(
  input: UpdateClientDto,
  before: Record<string, unknown>,
  variant: 'billing' | 'shipping',
): RecruitAddress | null {
  const keys = variant === 'billing' ? BILLING_KEYS : SHIPPING_KEYS;
  const obj: RecruitAddress = {};
  for (const key of keys) {
    const incoming = input[key];
    const value = incoming !== undefined
      ? (incoming === null || incoming === '' ? null : incoming)
      : ((before[key] as string | null | undefined) ?? null);
    if (value != null && value !== '') {
      obj[addressJsonbKeyFor(key)] = value;
    }
  }
  return Object.keys(obj).length === 0 ? null : obj;
}

function addressJsonbKeyFor(
  key: typeof BILLING_KEYS[number] | typeof SHIPPING_KEYS[number],
): keyof RecruitAddress {
  // billingStreet → "Street", billingCode → "Code" (mapped to "postalCode"),
  // shippingProvince → "Province", etc.
  const stripped = key.replace(/^(billing|shipping)/, '');
  if (stripped === 'Code') return 'postalCode';
  return (stripped.charAt(0).toLowerCase() + stripped.slice(1)) as keyof RecruitAddress;
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  return value;
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
