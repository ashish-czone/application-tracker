import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { clients } from '../schema/clients';
import { clientContacts } from '../schema/client-contacts';
import { CLIENTS_CREATED, CLIENT_CONTACTS_CREATED } from '../events/types';
import { ClientDormancyService } from './client-dormancy.service';

export interface ClientInput {
  name: string;
  legalName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  industryId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryId?: string | null;
  accountManagerId?: string | null;
  status?: string;
  onboardedAt?: Date | null;
  notes?: string | null;
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface CreateWithContactsInput {
  client: ClientInput;
  contacts: ContactInput[];
}

export interface Client {
  id: string;
  name: string;
  legalName: string;
  status: string;
  createdAt: Date;
}

export interface Contact {
  id: string;
  clientId: string;
  name: string;
  isPrimary: boolean;
}

export interface CreateWithContactsResult {
  client: Client;
  contacts: Contact[];
}

/**
 * Merged service: CRUD delegates for the entity engine + the transactional
 * status transition (with dormancy cascade) + the composite
 * `createWithContacts` flow. Generic CRUD routes through the engine; the
 * transition method composes the engine's split primitives
 * (`validateTransition` / `applyTransition` / `emitTransitionEvent`) so the
 * dormancy cascade commits atomically with the status flip — no engine hook
 * indirection.
 */
@Injectable()
export class ClientsService {
  constructor(
    @Inject('ENTITY_SERVICE_clients') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly dormancy: ClientDormancyService,
  ) {}

  // ---- CRUD delegates (vendors template) -----------------------------------

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: Record<string, unknown>, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(
    id: string,
    input: Record<string, unknown>,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
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

  // ---- Workflow transition with service-owned cascade tx -------------------

  /**
   * Transition a workflow field on a client. Uses the engine's split
   * primitives (validate → apply → emit) so this service owns the tx and
   * can piggyback the dormancy cascade on the same tx atomically.
   *
   * When `status` flips `active → dormant`, every non-terminal compliance
   * filing for the client is auto-cancelled (Q6). The cascade runs inside
   * the same tx as the status update + workflow history — throwing rolls
   * the whole transition back.
   */
  async transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const ctx = await this.entityService.validateTransition(
      id,
      fieldKey,
      toState,
      actorId,
      options,
      accessCtx,
    );

    const isDormantisation =
      ctx.fieldKey === 'status' &&
      ctx.fromState === 'active' &&
      ctx.toState === 'dormant';

    let cancelledFilingIds: string[] = [];

    await this.database.db.transaction(async (tx) => {
      await this.entityService.applyTransition(ctx, tx);
      if (isDormantisation) {
        const result = await this.dormancy.cancelInFlightFilings(ctx, tx);
        cancelledFilingIds = result.cancelledFilingIds;
      }
    });

    this.entityService.emitTransitionEvent(ctx);
    if (isDormantisation) {
      this.dormancy.emitCascadeEvent(ctx, cancelledFilingIds);
    }

    return this.entityService.findOneOrFail(id);
  }

  // ---- Composite create-with-contacts --------------------------------------

  /**
   * Create a client together with its contacts in a single transaction.
   * Exactly one contact must be flagged as primary — the partial unique
   * index on (client_id) WHERE is_primary = true enforces this at the
   * database level, but we validate up-front to return a readable error.
   *
   * Emits `clients.Created` and one `client-contacts.Created` per contact
   * after the transaction commits. Names mirror the entity-engine dynamic
   * events so listeners receive the same stream whether a client is
   * created via generic CRUD or via this endpoint.
   */
  async createWithContacts(
    input: CreateWithContactsInput,
    actorId: string | null = null,
  ): Promise<CreateWithContactsResult> {
    this.validateContacts(input.contacts);

    const { clientRow, contactRows } = await this.database.db.transaction(async (tx) => {
      // The address columns are mixed in via addressColumns() from
      // @packages/address, which returns Record<string, PgColumn>, so Drizzle's
      // $inferInsert doesn't currently surface their keys at the type level.
      // Cast the value object to bypass the check — at runtime the columns
      // exist on the table and Drizzle maps them correctly. A platform
      // improvement to addressColumns() can remove this cast later.
      const clientValues = {
        name: input.client.name,
        legalName: input.client.legalName,
        email: input.client.email ?? null,
        phone: input.client.phone ?? null,
        website: input.client.website ?? null,
        taxId: input.client.taxId ?? null,
        industryId: input.client.industryId ?? null,
        addressLine1: input.client.addressLine1 ?? null,
        addressLine2: input.client.addressLine2 ?? null,
        city: input.client.city ?? null,
        state: input.client.state ?? null,
        postalCode: input.client.postalCode ?? null,
        countryId: input.client.countryId ?? null,
        accountManagerId: input.client.accountManagerId ?? null,
        status: input.client.status ?? 'onboarding',
        onboardedAt: input.client.onboardedAt ?? null,
        notes: input.client.notes ?? null,
      };
      const [row] = await tx
        .insert(clients)
        .values(clientValues as typeof clients.$inferInsert)
        .returning();

      const contactValues = input.contacts.map((c) => ({
        clientId: row.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        designation: c.designation ?? null,
        isPrimary: c.isPrimary ?? false,
        notes: c.notes ?? null,
      }));

      const contacts = await tx.insert(clientContacts).values(contactValues).returning();
      return { clientRow: row, contactRows: contacts };
    });

    this.events.emitDynamic(CLIENTS_CREATED, {
      entityType: 'clients',
      entityId: clientRow.id,
      actorId,
      payload: { after: clientRow as unknown as Record<string, unknown> },
    });
    for (const contact of contactRows) {
      this.events.emitDynamic(CLIENT_CONTACTS_CREATED, {
        entityType: 'client-contacts',
        entityId: contact.id,
        actorId,
        payload: { after: contact as unknown as Record<string, unknown> },
      });
    }

    return {
      client: this.toClient(clientRow),
      contacts: contactRows.map((r) => this.toContact(r)),
    };
  }

  private validateContacts(contacts: ContactInput[]): void {
    if (!contacts || contacts.length < 1) {
      throw new BadRequestException('At least one contact is required');
    }
    const primaryCount = contacts.filter((c) => c.isPrimary === true).length;
    if (primaryCount !== 1) {
      throw new BadRequestException(
        `Exactly one contact must be marked as primary (got ${primaryCount})`,
      );
    }
  }

  private toClient(row: typeof clients.$inferSelect): Client {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legalName,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  private toContact(row: typeof clientContacts.$inferSelect): Contact {
    return {
      id: row.id,
      clientId: row.clientId,
      name: row.name,
      isPrimary: row.isPrimary,
    };
  }
}
