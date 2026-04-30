import { ConflictException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import {
  DatabaseService,
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type DrizzleTx,
  type SQL,
} from '@packages/database';
import { computePagination, computePaginationMeta } from '@packages/query-builder';
import {
  ClientsService as DirectoryClientsService,
  type FindOrCreateClientInput,
  type UpdateClientInput,
} from '@packages/directory';
import { ScopeResolverRegistry, type DataAccessContext } from '@packages/rbac';
import { DomainEventEmitter } from '@packages/events';
import { LookupResolverService, type CustomLookupResolver, type LookupResult } from '@packages/entity-engine';
import type { PaginatedResponse } from '@packages/common';
import type { CreateClientDto, UpdateClientDto } from './clients.dto';
import { clients, type RecruitAddress } from './clients-ref';

/** Subset of `BaseListQuery` we read directly. */
interface ClientsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

const SORTABLE = {
  clientName: clients.name,
  industry: clients.industry,
  createdAt: clients.recruitBecameClientAt,
  updatedAt: clients.updatedAt,
} as const;

/** A directory client row IS a recruit client when this marker is set. */
const IS_RECRUIT_CLIENT = isNotNull(clients.recruitBecameClientAt);

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(
    private readonly database: DatabaseService,
    private readonly directoryClients: DirectoryClientsService,
    private readonly scopeResolvers: ScopeResolverRegistry,
    private readonly events: DomainEventEmitter,
    private readonly lookupResolver: LookupResolverService,
  ) {}

  onModuleInit(): void {
    this.lookupResolver.registerResolver('clients', this.buildLookupResolver());
  }

  private buildLookupResolver(): CustomLookupResolver {
    return {
      search: async (query, limit): Promise<LookupResult[]> => {
        const term = `%${query}%`;
        const rows = await this.database.db
          .select({ label: clients.name, value: clients.id })
          .from(clients)
          .where(and(IS_RECRUIT_CLIENT, isNull(clients.recruitArchivedAt), ilike(clients.name, term)))
          .limit(limit);
        return rows.map(r => ({ label: String(r.label ?? ''), value: String(r.value ?? '') }));
      },

      getLabel: async (value) => {
        const [row] = await this.database.db
          .select({ label: clients.name })
          .from(clients)
          .where(eq(clients.id, value))
          .limit(1);
        return row ? String(row.label ?? '') : null;
      },

      getBatchLabels: async (values) => {
        const rows = await this.database.db
          .select({ id: clients.id, label: clients.name })
          .from(clients)
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

    const conditions: SQL[] = [IS_RECRUIT_CLIENT];

    const scopeCond = await this.resolveScope(accessCtx);
    if (scopeCond) conditions.push(scopeCond);

    if (!query.includeDeleted) {
      conditions.push(isNull(clients.recruitArchivedAt));
    }

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(ilike(clients.name, term));
    }

    const where = and(...conditions);
    const orderExpr = this.resolveSort(query);

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(clients)
      .where(where);

    const rows = await this.database.db
      .select(this.buildSelectMap())
      .from(clients)
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
    const conditions: SQL[] = [eq(clients.id, id), IS_RECRUIT_CLIENT, isNull(clients.recruitArchivedAt)];

    const scopeCond = await this.resolveScope(accessCtx);
    if (scopeCond) conditions.push(scopeCond);

    const [row] = await this.database.db
      .select(this.buildSelectMap())
      .from(clients)
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
      const client = await this.directoryClients.findOrCreate(
        toFindOrCreateClient(input),
        actorId,
        tx,
      );
      const now = new Date();

      await tx
        .update(clients)
        .set({
          recruitAbout: input.about ?? null,
          recruitContactNumber: input.contactNumber ?? null,
          recruitSource: input.source ?? 'added-by-user',
          recruitBillingAddress: toAddressJsonb(input, 'billing'),
          recruitShippingAddress: toAddressJsonb(input, 'shipping'),
          recruitBecameClientAt: now,
          recruitArchivedAt: null,
        })
        .where(eq(clients.id, client.id));

      return { id: client.id };
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

    await this.database.db.transaction(async (tx) => {
      // Identity sync — translate clientName/website/industry → directory base columns.
      const clientPatch = toClientPatch(input);
      if (Object.keys(clientPatch).length > 0) {
        try {
          await this.directoryClients.update(id, clientPatch, actorId, tx);
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(
              clientPatch.name
                ? `A client named "${clientPatch.name}" already exists in the directory. Use the Directory merge tool to combine identities.`
                : `Directory uniqueness conflict — use the Directory merge tool to resolve.`,
            );
          }
          throw error;
        }
      }

      // Recruit-prefix patch on the same client row. Address jsonb is rebuilt
      // by merging the patch over previous flat values from `before`.
      const recruitPatch = toClientRecruitPatch(input, before);
      if (Object.keys(recruitPatch).length > 0) {
        await tx
          .update(clients)
          .set(recruitPatch)
          .where(eq(clients.id, id));
      }
    });

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

    return { id };
  }

  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    const before = await this.findOne(id, accessCtx);
    const now = new Date();

    await this.database.db
      .update(clients)
      .set({ recruitArchivedAt: now })
      .where(eq(clients.id, id));

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
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, id), IS_RECRUIT_CLIENT))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Client not found');
    }

    await this.database.db
      .update(clients)
      .set({ recruitArchivedAt: null })
      .where(eq(clients.id, id));

    return this.findOne(id);
  }

  /**
   * Picker bridge: stamp `clients.recruit_became_client_at` for the picked
   * directory client so it shows up as a recruit client. Returns `{ id }` —
   * child tables FK the shared identity row directly, so the picker stores
   * the `clients.id`.
   */
  async findOrCreateForClient(
    clientId: string,
    actorId: string,
    externalTx?: DrizzleTx,
  ): Promise<{ id: string; created: boolean }> {
    const exec = externalTx ?? this.database.db;
    const [existing] = await exec
      .select({ id: clients.id, became: clients.recruitBecameClientAt })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    if (!existing) {
      throw new NotFoundException('Client not found');
    }
    if (existing.became) {
      return { id: clientId, created: false };
    }

    const now = new Date();
    await exec
      .update(clients)
      .set({ recruitBecameClientAt: now, recruitArchivedAt: null })
      .where(eq(clients.id, clientId));

    const snapshot = await this.findOne(clientId);
    this.events.emitDynamic('clients.Created', {
      entityType: 'clients',
      entityId: clientId,
      actorId,
      payload: { after: snapshot },
    });

    return { id: clientId, created: true };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  private buildSelectMap() {
    return {
      id: clients.id,
      clientId: clients.id, // alias — the row id IS the directory client id
      clientName: clients.name,
      contactNumber: clients.recruitContactNumber,
      website: clients.websiteDomain,
      industry: clients.industry,
      about: clients.recruitAbout,
      source: clients.recruitSource,
      billingStreet: sql<string | null>`${clients.recruitBillingAddress}->>'street'`.as('billing_street'),
      billingCity: sql<string | null>`${clients.recruitBillingAddress}->>'city'`.as('billing_city'),
      billingProvince: sql<string | null>`${clients.recruitBillingAddress}->>'province'`.as('billing_province'),
      billingCode: sql<string | null>`${clients.recruitBillingAddress}->>'postalCode'`.as('billing_code'),
      billingCountry: sql<string | null>`${clients.recruitBillingAddress}->>'country'`.as('billing_country'),
      shippingStreet: sql<string | null>`${clients.recruitShippingAddress}->>'street'`.as('shipping_street'),
      shippingCity: sql<string | null>`${clients.recruitShippingAddress}->>'city'`.as('shipping_city'),
      shippingProvince: sql<string | null>`${clients.recruitShippingAddress}->>'province'`.as('shipping_province'),
      shippingCode: sql<string | null>`${clients.recruitShippingAddress}->>'postalCode'`.as('shipping_code'),
      shippingCountry: sql<string | null>`${clients.recruitShippingAddress}->>'country'`.as('shipping_country'),
      createdBy: clients.createdBy,
      createdAt: clients.recruitBecameClientAt,
      updatedAt: clients.updatedAt,
      deletedAt: clients.recruitArchivedAt,
      contactsCount: sql<number>`(
        SELECT COUNT(*)::integer FROM "recruit_contacts"
        WHERE "company_id" = ${clients.id} AND "deleted_at" IS NULL
      )`.as('contactsCount'),
      jobOpeningsCount: sql<number>`(
        SELECT COUNT(*)::integer FROM "job_openings"
        WHERE "company_id" = ${clients.id} AND "deleted_at" IS NULL
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

function toFindOrCreateClient(input: CreateClientDto): FindOrCreateClientInput {
  return {
    name: input.clientName,
    websiteDomain: normalizeWebsiteDomain(input.website),
    industry: input.industry ?? null,
  };
}

function toClientPatch(input: UpdateClientDto): UpdateClientInput {
  const patch: UpdateClientInput = {};
  if (input.clientName !== undefined) patch.name = input.clientName;
  if (input.website !== undefined) patch.websiteDomain = normalizeWebsiteDomain(input.website);
  if (input.industry !== undefined) patch.industry = input.industry ?? null;
  return patch;
}

const BILLING_KEYS = ['billingStreet', 'billingCity', 'billingProvince', 'billingCode', 'billingCountry'] as const;
const SHIPPING_KEYS = ['shippingStreet', 'shippingCity', 'shippingProvince', 'shippingCode', 'shippingCountry'] as const;

function toClientRecruitPatch(
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
