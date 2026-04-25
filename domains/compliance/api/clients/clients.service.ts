import { Inject, Injectable, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import {
  runTransitionGuards,
  previewTransitionGuards,
  type TransitionGuard,
} from '@packages/workflows';
import { clients } from '../schema/clients';
import { clientContacts } from '../schema/client-contacts';
import { CLIENTS_CREATED, CLIENT_CONTACTS_CREATED } from '../events/types';
import { ClientDormancyService } from './client-dormancy.service';
import { ClientContactsService } from '../client-contacts/client-contacts.service';

interface ClientGuardDeps {
  contacts: ClientContactsService;
  dormancy: ClientDormancyService;
}

type ClientRow = Record<string, unknown> & { id: string };

/**
 * Declarative guards for client transitions. Each row describes exactly when
 * it fires (`from` → `to`) and what it checks. Throw to block, return a
 * string to surface a warning, return void to allow.
 */
const CLIENT_GUARDS: TransitionGuard<ClientRow, ClientGuardDeps>[] = [
  {
    name: 'require-primary-contact',
    from: 'onboarding',
    to: 'active',
    check: async (client, { deps }) => {
      const hasPrimary = await deps.contacts.hasPrimaryContact(client.id);
      if (!hasPrimary) {
        throw new UnprocessableEntityException(
          'Add a primary contact before activating this client.',
        );
      }
    },
  },
  {
    name: 'warn-dormant-cascade',
    from: 'active',
    to: 'dormant',
    check: async (client, { deps }) => {
      const count = await deps.dormancy.countNonTerminalFilings(client.id);
      if (count === 0) return;
      const noun = count === 1 ? 'filing' : 'filings';
      return `${count} non-terminal ${noun} will be cancelled when this client is dormantised.`;
    },
  },
];

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
    private readonly contacts: ClientContactsService,
  ) {}

  private guardDeps(): ClientGuardDeps {
    return { contacts: this.contacts, dormancy: this.dormancy };
  }

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
    // Per-entity guards run before the engine. Other field flips skip the
    // guard step entirely — only `status` has gating logic on this entity.
    let warnings: string[] = [];
    if (fieldKey === 'status') {
      const entity = await this.entityService.findOneOrFail(id, accessCtx);
      const fromState = entity[fieldKey] as string | null;
      if (!fromState) {
        throw new BadRequestException(`Entity has no current state for field '${fieldKey}'`);
      }
      warnings = await runTransitionGuards(CLIENT_GUARDS, entity as ClientRow, {
        fromState, toState, actor: actorId, deps: this.guardDeps(),
      });
    }

    const ctx = await this.entityService.validateTransition(
      id, fieldKey, toState, actorId, options, accessCtx,
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

    const fresh = await this.entityService.findOneOrFail(id);
    return warnings.length > 0 ? { ...fresh, warnings } : fresh;
  }

  /**
   * Preview a proposed transition: runs per-entity guards in collect-mode
   * (advisory). UI confirm dialog calls this to populate warning + blocker
   * banners before committing. Does NOT touch the database. The legality +
   * permissions check stays on `/workflows/preflight` — UI merges results.
   */
  async previewTransition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    accessCtx?: DataAccessContext,
  ): Promise<{ warnings: string[]; blockers: string[] }> {
    if (fieldKey !== 'status') return { warnings: [], blockers: [] };
    const entity = await this.entityService.findOneOrFail(id, accessCtx);
    const fromState = entity[fieldKey] as string | null;
    if (!fromState) return { warnings: [], blockers: [] };
    return previewTransitionGuards(CLIENT_GUARDS, entity as ClientRow, {
      fromState, toState, actor: actorId, deps: this.guardDeps(),
    });
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
