import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { clientContacts } from './client-contacts.schema';
import { CLIENT_CONTACTS_UPDATED } from '../events/types';
import type { CreateClientContactDto, UpdateClientContactDto } from './client-contacts.dto';

type ContactRow = typeof clientContacts.$inferSelect;

/**
 * Merged service: baseline CRUD delegates for the entity engine + the
 * domain-specific primary-contact operations (hasPrimaryContact used by the
 * workflow guard on client onboarding → active; setPrimary called from the
 * clients controller to flip the primary flag atomically).
 */
@Injectable()
export class ClientContactsService {
  constructor(
    @Inject('ENTITY_SERVICE_client-contacts') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  // ---- CRUD delegates (vendors template) -----------------------------------

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: CreateClientContactDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateClientContactDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
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

  // ---- Domain-specific primary-contact handling ----------------------------

  /**
   * True when the client has at least one contact flagged as primary.
   * Used by the `require-primary-contact` workflow guard on the
   * onboarding → active transition.
   */
  async hasPrimaryContact(clientId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(withScope(
        clientContacts,
        eq(clientContacts.complianceClientId, clientId),
        eq(clientContacts.complianceIsPrimary, true),
      ))
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
        .where(withScope(
          clientContacts,
          eq(clientContacts.id, contactId),
          eq(clientContacts.complianceClientId, clientId),
        ));

      if (!existing) {
        throw new NotFoundException(
          `Contact ${contactId} not found under client ${clientId}`,
        );
      }

      if (existing.complianceIsPrimary) return null;

      const demoted = await tx
        .update(clientContacts)
        .set({ complianceIsPrimary: false })
        .where(withScope(
          clientContacts,
          eq(clientContacts.complianceClientId, clientId),
          eq(clientContacts.complianceIsPrimary, true),
        ))
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
