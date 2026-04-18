import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { clientContacts } from '../schema/client-contacts';
import { CLIENT_CONTACTS_UPDATED } from '../events/types';

type ContactRow = typeof clientContacts.$inferSelect;

/**
 * Contact-specific operations. CRUD is handled by the generic entity-engine
 * controller (POST/GET/PATCH/DELETE /client-contacts), so this service only
 * owns behavior that needs multi-row coordination.
 */
@Injectable()
export class ClientContactsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  /**
   * True when the client has at least one contact flagged as primary.
   * Used by the `require-primary-contact` workflow guard on the
   * onboarding → active transition.
   */
  async hasPrimaryContact(clientId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.isPrimary, true)))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Flip the primary-contact flag atomically: unset whichever contact is
   * currently primary for the client, then set the target contact as primary.
   * The partial unique index on (client_id) WHERE is_primary = true would
   * reject the naive two-step approach if it ran out-of-order, so the unset
   * and set live inside a single transaction.
   *
   * No-op if the target contact is already primary. Emits `client-contacts.Updated`
   * after commit for both the demoted and the promoted row.
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
        .where(and(eq(clientContacts.id, contactId), eq(clientContacts.clientId, clientId)));

      if (!existing) {
        throw new NotFoundException(
          `Contact ${contactId} not found under client ${clientId}`,
        );
      }

      if (existing.isPrimary) return null;

      const demoted = await tx
        .update(clientContacts)
        .set({ isPrimary: false })
        .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.isPrimary, true)))
        .returning();

      const [promoted] = await tx
        .update(clientContacts)
        .set({ isPrimary: true })
        .where(eq(clientContacts.id, contactId))
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
          before: { ...row, isPrimary: true } as Record<string, unknown>,
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
