import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { clientContacts } from '../schema/client-contacts';

/**
 * Contact-specific operations. CRUD is handled by the generic entity-engine
 * controller (POST/GET/PATCH/DELETE /client-contacts), so this service only
 * owns behavior that needs multi-row coordination.
 */
@Injectable()
export class ClientContactsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Flip the primary-contact flag atomically: unset whichever contact is
   * currently primary for the client, then set the target contact as primary.
   * The partial unique index on (client_id) WHERE is_primary = true would
   * reject the naive two-step approach if it ran out-of-order, so the unset
   * and set live inside a single transaction.
   *
   * No-op if the target contact is already primary.
   */
  async setPrimary(clientId: string, contactId: string): Promise<void> {
    return this.database.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(clientContacts)
        .where(and(eq(clientContacts.id, contactId), eq(clientContacts.clientId, clientId)));

      if (!existing) {
        throw new NotFoundException(
          `Contact ${contactId} not found under client ${clientId}`,
        );
      }

      if (existing.isPrimary) {
        return;
      }

      await tx
        .update(clientContacts)
        .set({ isPrimary: false })
        .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.isPrimary, true)));

      await tx
        .update(clientContacts)
        .set({ isPrimary: true })
        .where(eq(clientContacts.id, contactId));
    });
  }
}
