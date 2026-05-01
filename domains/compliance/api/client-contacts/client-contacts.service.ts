import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService } from '@packages/logger';
import { BaseCrudService } from '@packages/entity-engine';
import { clientContacts } from './client-contacts.schema';
import { CLIENT_CONTACTS_UPDATED } from '../events/types';

type ContactRow = typeof clientContacts.$inferSelect;

/**
 * Client contacts service. Inherits standard CRUD from `BaseCrudService`
 * (sprint 6 of the camp-B migration); adds the two domain-specific
 * primary-contact operations.
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
export class ClientContactsService extends BaseCrudService(clientContacts, {
  slug: 'client-contacts',
  events: {
    created: 'client-contacts.Created',
    updated: 'client-contacts.Updated',
    deleted: 'client-contacts.Deleted',
  },
}) {
  constructor(database: DatabaseService, events: DomainEventEmitter, appLogger: AppLoggerService) {
    super(database, events, appLogger);
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
