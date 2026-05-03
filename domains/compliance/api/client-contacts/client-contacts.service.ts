import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { BaseCrudService } from '@packages/crud-base';
import { buildListQuery } from '@packages/query-builder';
import { DataAccessScopeService, type DataAccessContext } from '@packages/rbac';
import { clientContacts } from './client-contacts.schema';
import { CLIENT_CONTACTS_UPDATED } from '../events/types';
import { CLIENT_CONTACTS_CRUD_TOKEN } from './client-contacts.crud-token';
import { CLIENT_CONTACTS_ANCHORS } from './client-contacts.scope';
import type {
  ClientContactsListQuery,
  CreateClientContactDto,
  UpdateClientContactDto,
} from './client-contacts.dto';

type ContactRow = typeof clientContacts.$inferSelect;

/**
 * Whitelisted columns for the list endpoint's structured `filters`
 * JSON and bare passthrough id filters. Anything outside this map is
 * silently dropped — the frontend cannot push arbitrary column
 * predicates through. `complianceClientId` is the primary access
 * pattern (the client detail page sends `?complianceClientId=…`).
 */
const FILTERABLE_CLIENT_CONTACT_COLUMNS = {
  id: clientContacts.id,
  clientId: clientContacts.clientId,
  complianceClientId: clientContacts.complianceClientId,
  complianceDesignation: clientContacts.complianceDesignation,
  complianceIsPrimary: clientContacts.complianceIsPrimary,
  primaryEmail: clientContacts.primaryEmail,
  primaryPhone: clientContacts.primaryPhone,
  jobTitle: clientContacts.jobTitle,
  doNotContact: clientContacts.doNotContact,
  createdAt: clientContacts.createdAt,
  updatedAt: clientContacts.updatedAt,
} as const;

/**
 * Whitelisted sort keys. Anything outside this map falls back to the
 * `defaultSort` registered with `buildListQuery` (`fullName` ASC — the
 * typical user-facing label on the contacts list).
 */
const SORTABLE_CLIENT_CONTACT_COLUMNS = {
  fullName: clientContacts.fullName,
  primaryEmail: clientContacts.primaryEmail,
  jobTitle: clientContacts.jobTitle,
  complianceDesignation: clientContacts.complianceDesignation,
  complianceIsPrimary: clientContacts.complianceIsPrimary,
  createdAt: clientContacts.createdAt,
  updatedAt: clientContacts.updatedAt,
} as const;

/**
 * Client contacts service. Composes with `BaseCrudService` (no inheritance)
 * for the standard CRUD flows; adds the two domain-specific primary-contact
 * operations.
 *
 * Custom methods:
 *  - `hasPrimaryContact(clientId)` — read predicate consumed by the
 *    `require-primary-contact` workflow guard on a client's
 *    onboarding → active transition.
 *  - `setPrimary(clientId, contactId, actorId)` — atomic flip of the
 *    primary flag; the partial unique index on (client_id) WHERE
 *    is_primary = true would reject the naive two-step approach if
 *    it ran out-of-order, so the unset and set live inside one tx.
 *    Emits `CLIENT_CONTACTS_UPDATED` for both the demoted and promoted
 *    rows after commit.
 */
@Injectable()
export class ClientContactsService {
  constructor(
    @Inject(CLIENT_CONTACTS_CRUD_TOKEN)
    private readonly crud: BaseCrudService<typeof clientContacts>,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly dataAccessScope: DataAccessScopeService,
  ) {}

  /**
   * Server-paginated list with structured filters JSON, bare passthrough
   * id filters (`?complianceClientId=…`), ILIKE search across name +
   * contact channels, whitelisted sort, and a SQL `count()` for
   * `meta.total`.
   *
   * Bypasses `BaseCrudService.list` because the base is by design a
   * trivial pagination wrapper that drops filters and reports
   * `total = rows.length` (the page size, not the table count). Without
   * this, the client detail page's `?complianceClientId=…` filter was
   * silently ignored — every fetch returned the first 10 contacts in the
   * tenant, not the contacts for that client.
   *
   * Actor-scope: `CLIENT_CONTACTS_ANCHORS` is registered on the
   * `BaseCrudService` and is dormant today (no role grant uses a
   * non-`'any'` scope on `client-contacts.read`). We still call
   * `buildPredicate(...)` so a future scoped grant lights up without a
   * code change here — `buildPredicate` returns `undefined` when scope is
   * `'any'`, which composes as a no-op through `withScope`.
   */
  async list(query: ClientContactsListQuery, accessCtx?: DataAccessContext) {
    const scopePredicate = accessCtx
      ? await this.dataAccessScope.buildPredicate(accessCtx, {
          anchors: CLIENT_CONTACTS_ANCHORS,
        })
      : undefined;

    const built = buildListQuery(clientContacts, query, {
      scopePredicate,
      filterableColumns: FILTERABLE_CLIENT_CONTACT_COLUMNS,
      sortableColumns: SORTABLE_CLIENT_CONTACT_COLUMNS,
      searchableColumns: [
        clientContacts.fullName,
        clientContacts.primaryEmail,
        clientContacts.primaryPhone,
        clientContacts.jobTitle,
      ],
      defaultSort: { field: 'fullName', order: 'asc' },
      includeDeleted: query.includeDeleted,
    });

    const rows = await this.database.db
      .select()
      .from(clientContacts)
      .where(built.where)
      .orderBy(...built.orderBy)
      .limit(built.limit)
      .offset(built.offset);

    const [totalRow] = await this.database.db
      .select({ total: count() })
      .from(clientContacts)
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
   * Inject `createdBy` from the actor — the directory `client_contacts`
   * table requires it NOT NULL, but it never appears in the request body
   * (the actor comes from the JWT). The narrow Zod input type stays clean
   * for callers; the column merge happens here.
   */
  create(input: CreateClientContactDto, actorId: string) {
    return this.crud.create({ ...input, createdBy: actorId } as never, actorId);
  }

  update(
    id: string,
    input: UpdateClientContactDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }

  /**
   * True when the client has at least one contact flagged as primary.
   * Used by the `require-primary-contact` workflow guard on the
   * onboarding → active transition.
   */
  async hasPrimaryContact(clientId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(
        withScope(
          clientContacts,
          eq(clientContacts.complianceClientId, clientId),
          eq(clientContacts.complianceIsPrimary, true),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Flip the primary-contact flag atomically: unset whichever contact is
   * currently primary for the client, then set the target contact as primary.
   *
   * The partial unique index on (client_id) WHERE is_primary = true would
   * reject the naive two-step approach if it ran out-of-order, so the unset
   * and set live inside a single transaction.
   *
   * No-op if the target contact is already primary. Emits
   * `client-contacts.Updated` after commit for both the demoted and the
   * promoted row.
   */
  async setPrimary(
    clientId: string,
    contactId: string,
    actorId: string | null = null,
  ): Promise<void> {
    const changed = await this.database.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(clientContacts)
        .where(
          withScope(
            clientContacts,
            eq(clientContacts.id, contactId),
            eq(clientContacts.complianceClientId, clientId),
          ),
        );

      if (!existing) {
        throw new NotFoundException(
          `Contact ${contactId} not found under client ${clientId}`,
        );
      }

      if (existing.complianceIsPrimary) return null;

      const demoted = await tx
        .update(clientContacts)
        .set({ complianceIsPrimary: false })
        .where(
          withScope(
            clientContacts,
            eq(clientContacts.complianceClientId, clientId),
            eq(clientContacts.complianceIsPrimary, true),
          ),
        )
        .returning();

      const [promoted] = await tx
        .update(clientContacts)
        .set({ complianceIsPrimary: true })
        .where(withScope(clientContacts, eq(clientContacts.id, contactId)))
        .returning();

      return { demoted, promoted, previous: existing };
    });

    if (!changed) return;

    for (const row of changed.demoted) {
      this.events.emitDynamic(CLIENT_CONTACTS_UPDATED, {
        entityType: 'client-contacts',
        entityId: row.id,
        actorId,
        payload: {
          before: { ...row, complianceIsPrimary: true } as Record<string, unknown>,
          after: row as unknown as Record<string, unknown>,
        },
      });
    }
    this.events.emitDynamic(CLIENT_CONTACTS_UPDATED, {
      entityType: 'client-contacts',
      entityId: changed.promoted.id,
      actorId,
      payload: {
        before: changed.previous as unknown as Record<string, unknown>,
        after: changed.promoted as unknown as Record<string, unknown>,
      },
    });
  }
}

export type { ContactRow };
