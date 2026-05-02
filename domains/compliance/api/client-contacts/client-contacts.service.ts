import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { BaseCrudService } from '@packages/crud-base';
import type { DataAccessContext } from '@packages/rbac';
import { clientContacts } from './client-contacts.schema';
import { CLIENT_CONTACTS_UPDATED } from '../events/types';
import { CLIENT_CONTACTS_CRUD_TOKEN } from './client-contacts.crud-token';
import type { CreateClientContactDto, UpdateClientContactDto } from './client-contacts.dto';

type ContactRow = typeof clientContacts.$inferSelect;

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
  ) {}

  list(
    query: Parameters<BaseCrudService<typeof clientContacts>['list']>[0] = {},
    accessCtx?: DataAccessContext,
  ) {
    return this.crud.list(query, accessCtx);
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
