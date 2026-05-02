import { Inject, Injectable, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService, eq, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { type BaseListQuery, type TransitionContext } from '@packages/entity-engine';
import { BaseCrudService } from '@packages/crud-base';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import { CLIENTS_CRUD_TOKEN } from './clients.crud-token';
import type { DataAccessContext } from '@packages/rbac';
import {
  runTransitionGuards,
  previewTransitionGuards,
  type TransitionGuard,
} from '@packages/workflows';
import { clients } from './clients.schema';
import { clientContacts } from '../client-contacts/client-contacts.schema';
import { CLIENTS_CREATED, CLIENT_CONTACTS_CREATED } from '../events/types';
import { CLIENTS_WORKFLOW } from './clients.workflow';
import { ClientDormancyService } from './clients.dormancy.service';
import { ClientContactsService } from '../client-contacts/client-contacts.service';
import {
  ClientsRollupService,
  type ClientsSummary,
  type HandlerOption,
} from './clients.rollup.service';
import type { ClientsListQuery } from './clients.dto';

interface ClientGuardDeps {
  contacts: ClientContactsService;
  dormancy: ClientDormancyService;
}

type ClientRow = Record<string, unknown> & { id: string };

/**
 * Internal field-key translation: the controller-side `fieldKey: 'status'`
 * (the UI-facing key admins know) maps to the underlying `complianceStatus`
 * column on the shared `clients` table after the C-2 fold. Keeping the
 * external API stable on `'status'` means UIs and integrations don't need
 * to follow the storage rename. Inside the service we use the column key
 * everywhere — entity-engine reads/writes go through that name.
 */
const STATUS_FIELD_ALIAS = 'status';
const STATUS_COLUMN_KEY = 'complianceStatus';
function resolveFieldKey(fieldKey: string): string {
  return fieldKey === STATUS_FIELD_ALIAS ? STATUS_COLUMN_KEY : fieldKey;
}

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
  websiteDomain?: string | null;
  taxId?: string | null;
  industry?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  addressCountryId?: string | null;
  complianceAccountManagerId?: string | null;
  complianceStatus?: string;
  complianceOnboardedAt?: Date | null;
  complianceNotes?: string | null;
}

export interface ContactInput {
  fullName: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  complianceDesignation?: string | null;
  complianceIsPrimary?: boolean;
  complianceNotes?: string | null;
}

export interface CreateWithContactsInput {
  client: ClientInput;
  contacts: ContactInput[];
}

export interface Client {
  id: string;
  name: string;
  legalName: string | null;
  status: string | null;
  createdAt: Date;
}

export interface Contact {
  id: string;
  clientId: string | null;
  fullName: string;
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
    @Inject(CLIENTS_CRUD_TOKEN) private readonly crud: BaseCrudService<typeof clients>,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly dormancy: ClientDormancyService,
    private readonly contacts: ClientContactsService,
    private readonly rollup: ClientsRollupService,
  ) {}

  private guardDeps(): ClientGuardDeps {
    return { contacts: this.contacts, dormancy: this.dormancy };
  }

  // ---- CRUD delegates (vendors template) -----------------------------------

  /**
   * Compliance clients list goes through the rollup service so each row
   * carries server-computed metrics (registered laws, open / overdue / due
   * filings, on-time %, last filing date, derived risk band) and the handler
   * display name. Custom Drizzle path; the entity engine's list pipeline
   * doesn't express the per-row aggregates.
   *
   * Row-level scope: the actor's `DataAccessContext` is translated to a
   * SQL predicate via the engine and ANDed into the rollup CTE — same
   * scope filter that `entityService.list(…, accessCtx)` would have applied
   * if the engine pipeline could express the rollup.
   */
  async list(query: ClientsListQuery, accessCtx?: DataAccessContext) {
    // Clients has no `dataAccess` config — actor scope is a no-op for this
    // entity. The `accessCtx` parameter is preserved on the public API for
    // controller-level consistency but does not gate any rows.
    const scopePredicate = undefined;
    return this.rollup.list(query, scopePredicate);
  }

  /**
   * Page-level summary KPIs — total clients, byStatus, byRisk, totalOverdue,
   * clientsWithOverdue. Single round-trip; counts apply the same actor scope
   * as the list view so subtotals match.
   */
  async getSummary(accessCtx?: DataAccessContext): Promise<ClientsSummary> {
    // Clients has no `dataAccess` config — actor scope is a no-op for this
    // entity. The `accessCtx` parameter is preserved on the public API for
    // controller-level consistency but does not gate any rows.
    const scopePredicate = undefined;
    return this.rollup.getSummary(scopePredicate);
  }

  /**
   * Distinct account-manager users across compliance clients the actor can
   * read. Drives the filter dropdown — must mirror the list view's scope so
   * picking a handler doesn't surface clients outside the actor's scope.
   */
  async getHandlerOptions(accessCtx?: DataAccessContext): Promise<HandlerOption[]> {
    // Clients has no `dataAccess` config — actor scope is a no-op for this
    // entity. The `accessCtx` parameter is preserved on the public API for
    // controller-level consistency but does not gate any rows.
    const scopePredicate = undefined;
    return this.rollup.getHandlerOptions(scopePredicate);
  }

  async findOne(id: string, accessCtx?: DataAccessContext) {
    const row = await this.crud.findOneOrFail(id, accessCtx);
    return this.withStatusAlias(row);
  }

  /**
   * Creates a client and pre-fills `complianceStatus` with the workflow's
   * initialState. State is system-managed: the DTO strips any caller-supplied
   * value, so the only path that lands a client in a non-initial state is
   * `POST /:id/transition`. See `.claude/rules/workflow-entity-creates.md`.
   *
   * After the engine inserts the row, stamp `complianceBecameClientAt` via
   * a follow-up UPDATE — this column is not in the entity config's `fields`
   * (the engine rejects unknown fields), but the rollup queries filter on
   * `complianceBecameClientAt IS NOT NULL` to distinguish compliance clients
   * from rows owned by directory or other domains in the shared identity
   * table. The composite `createWithContacts` stamps the same marker inline.
   */
  async create(input: Record<string, unknown>, actorId: string) {
    const row = await this.crud.create(
      { ...input, complianceStatus: CLIENTS_WORKFLOW.initialState } as never,
      actorId,
    ) as Record<string, unknown>;
    if (row && !row.complianceBecameClientAt && typeof row.id === 'string') {
      const becameAt = new Date();
      await this.database.db
        .update(clients)
        .set({ complianceBecameClientAt: becameAt })
        .where(eq(clients.id, row.id));
      row.complianceBecameClientAt = becameAt;
    }
    return this.withStatusAlias(row);
  }

  async update(
    id: string,
    input: Record<string, unknown>,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    const row = await this.crud.update(id, input as never, actorId, accessCtx);
    return this.withStatusAlias(row);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }

  /**
   * Adds the public `status` alias to a row whose storage column is named
   * `complianceStatus`. The alias is a one-way response shim — input DTOs
   * do not accept `status` (workflow fields are system-managed; see the
   * rule). Generic CRUD reads + the transition response both flow through
   * here so consumers see a stable `status` field. Tolerates falsy rows
   * (e.g. service mocks returning undefined) by returning them unchanged.
   */
  private withStatusAlias<T>(row: T): T {
    if (!row || typeof row !== 'object') return row;
    const r = row as Record<string, unknown>;
    return { ...r, status: r.complianceStatus } as T;
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
   *
   * The caller-facing `fieldKey` is `'status'` for back-compat; internally
   * we translate to `'complianceStatus'` (the column key after C-2 fold).
   */
  async transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const internalFieldKey = resolveFieldKey(fieldKey);

    // Load the entity up front so we have `fromState` for validation +
    // `entity.name` for the dormancy cascade audit trail. (Pre-lift the
    // engine loaded it internally; now we own that read.)
    const entity = await this.crud.findOneOrFail(id, accessCtx) as Record<string, unknown>;
    const fromState = entity[internalFieldKey] as string | null;
    if (!fromState) {
      throw new BadRequestException(`Entity has no current state for field '${fieldKey}'`);
    }

    // Per-entity guards (require-primary-contact, warn-dormant-cascade)
    // run before the engine. Other fields skip — only `status` has gating
    // logic on this entity.
    let warnings: string[] = [];
    if (fieldKey === STATUS_FIELD_ALIAS) {
      warnings = await runTransitionGuards(CLIENT_GUARDS, entity as ClientRow, {
        fromState, toState, actor: actorId, deps: this.guardDeps(),
      });
    }

    const workflow = this.workflowRegistry.getByEntityField('clients', internalFieldKey);
    if (!workflow) {
      throw new BadRequestException(
        `No workflow registered for clients field '${internalFieldKey}'`,
      );
    }

    const validated = await this.workflowEngine.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: 'clients',
      entityId: id,
      fromState,
      toState,
      actorId,
      reason: options?.reason,
      comment: options?.comment,
      entityData: entity,
    });

    // Reconstruct the engine's `TransitionContext` shape for the dormancy
    // cascade hooks (they read entityId / entity.name / actorId / reason /
    // comment to build the cancellation history rows + cascade event).
    // Keeping the shape stable means dormancy doesn't have to change.
    const ctx: TransitionContext = {
      entityType: 'clients',
      entityId: id,
      fieldKey: internalFieldKey,
      fieldName: validated.fieldName,
      fromState,
      toState,
      transitionId: validated.transitionId,
      transitionName: validated.transitionName,
      workflowDefinitionId: validated.workflowDefinitionId,
      workflowSlug: workflow.slug,
      actorId,
      reason: options?.reason,
      comment: options?.comment,
      entity,
    };

    const isDormantisation =
      internalFieldKey === STATUS_COLUMN_KEY &&
      fromState === 'active' &&
      toState === 'dormant';

    let cancelledFilingIds: string[] = [];

    await this.database.db.transaction(async (tx) => {
      // Phase 2: column update + workflow_transition_history row + cascade
      // all commit together. A failure rolls the whole transition back.
      await tx
        .update(clients)
        .set({ [internalFieldKey]: toState })
        .where(withScope(clients, eq(clients.id, id)));

      await this.workflowEngine.recordHistory(
        {
          workflowDefinitionId: validated.workflowDefinitionId,
          entityType: 'clients',
          entityId: id,
          fieldName: validated.fieldName,
          fromState,
          toState,
          transitionId: validated.transitionId,
          actorId,
          reason: options?.reason,
          comment: options?.comment,
        },
        tx,
      );

      if (isDormantisation) {
        const result = await this.dormancy.cancelInFlightFilings(ctx, tx);
        cancelledFilingIds = result.cancelledFilingIds;
      }
    });

    this.emitTransitionEvent(ctx);

    if (isDormantisation) {
      // The in-tx cascade only catches filings that existed when its SELECT
      // ran. An event-driven generator (J3/J4/J5) on a different connection
      // can INSERT after that SELECT but before our COMMIT — its read of
      // clients.complianceStatus sees the pre-commit 'active' value, so its
      // own isClientActive guard passes. Sweep those stragglers now that
      // the dormantisation is committed and the new status is visible.
      const lateResult = await this.dormancy.sweepLateFilings(id);
      if (lateResult.cancelledFilingIds.length > 0) {
        cancelledFilingIds = [...cancelledFilingIds, ...lateResult.cancelledFilingIds];
      }
      this.dormancy.emitCascadeEvent(ctx, cancelledFilingIds);
    }

    const fresh = this.withStatusAlias(await this.crud.findOneOrFail(id));
    return warnings.length > 0 ? { ...fresh, warnings } : fresh;
  }

  /**
   * Emit `clients.<Field>Changed` after a workflow transition commits.
   * Mirrors the event shape `EntityService.emitTransitionEvent` produced
   * pre-lift so any listener subscribed to those events keeps receiving
   * the same payload.
   */
  private emitTransitionEvent(ctx: TransitionContext): void {
    const pascalField = ctx.fieldKey.charAt(0).toUpperCase() + ctx.fieldKey.slice(1);
    this.events.emitDynamic(`clients.${pascalField}Changed`, {
      entityType: 'clients',
      entityId: ctx.entityId,
      actorId: ctx.actorId,
      payload: {
        fieldKey: ctx.fieldKey,
        fromState: ctx.fromState,
        toState: ctx.toState,
        transitionId: ctx.transitionId,
        transitionName: ctx.transitionName,
        reason: ctx.reason,
        comment: ctx.comment,
      },
    });
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
    if (fieldKey !== STATUS_FIELD_ALIAS) return { warnings: [], blockers: [] };
    const internalFieldKey = resolveFieldKey(fieldKey);
    const entity = await this.crud.findOneOrFail(id, accessCtx) as Record<string, unknown>;
    const fromState = entity[internalFieldKey] as string | null;
    if (!fromState) return { warnings: [], blockers: [] };
    return previewTransitionGuards(CLIENT_GUARDS, entity as ClientRow, {
      fromState, toState, actor: actorId, deps: this.guardDeps(),
    });
  }

  // ---- Composite create-with-contacts --------------------------------------

  /**
   * Create a client together with its contacts in a single transaction.
   * Exactly one contact must be flagged as primary — the partial unique
   * index on (compliance_client_id) WHERE compliance_is_primary = true
   * enforces this at the database level, but we validate up-front to return
   * a readable error.
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

    const createdAt = new Date();
    const createdBy = actorId ?? 'system';

    const { clientRow, contactRows } = await this.database.db.transaction(async (tx) => {
      const clientValues: typeof clients.$inferInsert = {
        name: input.client.name,
        legalName: input.client.legalName,
        email: input.client.email ?? null,
        phone: input.client.phone ?? null,
        websiteDomain: input.client.websiteDomain ?? null,
        taxId: input.client.taxId ?? null,
        industry: input.client.industry ?? null,
        addressLine1: input.client.addressLine1 ?? null,
        addressLine2: input.client.addressLine2 ?? null,
        city: input.client.city ?? null,
        state: input.client.state ?? null,
        postalCode: input.client.postalCode ?? null,
        addressCountryId: input.client.addressCountryId ?? null,
        complianceAccountManagerId: input.client.complianceAccountManagerId ?? null,
        // Workflow state is system-managed — the DTO strips any caller-supplied
        // `complianceStatus` at the API boundary. Internal callers (CLI seeds)
        // may pre-set a non-initial state; otherwise we default to the
        // workflow's initialState. See `.claude/rules/workflow-entity-creates.md`.
        complianceStatus: input.client.complianceStatus ?? CLIENTS_WORKFLOW.initialState,
        complianceOnboardedAt: input.client.complianceOnboardedAt ?? null,
        complianceNotes: input.client.complianceNotes ?? null,
        // Marker that flags this row as a compliance client. Queries that
        // ask "is this company a compliance client?" filter on this column
        // being non-null. Stamped at create time so it survives later
        // updates that don't touch compliance fields.
        complianceBecameClientAt: createdAt,
        createdBy,
      };
      const [row] = await tx
        .insert(clients)
        .values(clientValues)
        .returning();

      const contactValues = input.contacts.map((c) => ({
        fullName: c.fullName,
        primaryEmail: c.primaryEmail ?? null,
        primaryPhone: c.primaryPhone ?? null,
        complianceClientId: row.id,
        complianceDesignation: c.complianceDesignation ?? null,
        complianceIsPrimary: c.complianceIsPrimary ?? false,
        complianceNotes: c.complianceNotes ?? null,
        createdBy,
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
    const primaryCount = contacts.filter((c) => c.complianceIsPrimary === true).length;
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
      status: row.complianceStatus,
      createdAt: row.createdAt,
    };
  }

  private toContact(row: typeof clientContacts.$inferSelect): Contact {
    return {
      id: row.id,
      clientId: row.complianceClientId,
      fullName: row.fullName,
      isPrimary: row.complianceIsPrimary,
    };
  }
}
