import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService, and, count, eq, gt, inArray, isNull, lte, not } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { complianceClientRegistrations } from '../schema/client-registrations';
import { complianceLaws } from '../schema/laws';
import { clients } from '../schema/clients';
import { complianceFilings } from '../schema/compliance-filings';
import { ComplianceFilingsCancellationService } from '../compliance-filings/compliance-filings-cancellation.service';
import { ComplianceRulesService } from '../rules/compliance-rules.service';
import {
  CLIENT_REGISTRATIONS_CREATED,
  COMPLIANCE_REGISTRATION_DEACTIVATED,
} from '../events/types';
import type { CreateClientRegistrationDto, UpdateClientRegistrationDto } from './client-registrations.dto';

/**
 * I20: raised when registration creation would produce a client/law tuple
 * for which no team can be resolved as the assignee — the four-tier walk
 * over `complianceLawHandlers` either matches nothing or matches multiple
 * rows at the same tier (ambiguous). In either case, filing generation
 * would later throw at assignment time, so we reject up front.
 *
 * UI hooks the `lawId` to deep-link the user to the law's handler config
 * page where the missing or duplicate row can be fixed.
 */
export class NoResolvableAssigneeError extends BadRequestException {
  constructor(lawId: string) {
    super({
      code: 'NO_RESOLVABLE_ASSIGNEE',
      message:
        'No team is configured to handle this law. ' +
        'Configure a handler for this law before registering clients.',
      lawId,
    });
  }
}

const TERMINAL_FILING_STATUSES = ['completed', 'cancelled'];

/**
 * Reasons written to workflow_transition_history.reason for filings cancelled
 * as a consequence of a registration being deactivated. Kept distinct so the
 * audit trail reconstructs intent: auto-cancelled because the registration
 * stopped before the period started, vs manually cancelled because the admin
 * explicitly opted in to also-cancel earlier periods.
 */
const REASON_AUTO_CANCELLED = 'Registration deactivated';
const REASON_MANUALLY_CANCELLED = 'Registration deactivation cleanup';

/**
 * `complianceFilings.periodStart` is a DATE column (no time component) stored
 * as `YYYY-MM-DD`. Comparisons against a JS `Date` must use the same format
 * so Drizzle/Postgres don't coerce a timestamp into the DATE column at the
 * boundary and shift by a timezone offset.
 */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ClientRegistration {
  id: string;
  clientId: string;
  lawId: string;
  registeredAt: Date;
  deactivatedAt: Date | null;
}

export interface DeactivationPreview {
  registrationId: string;
  deactivatedAt: string;
  cancelledAfter: number;
  remainingBefore: number;
}

export interface DeactivationResult {
  registrationId: string;
  deactivatedAt: string;
  autoCancelledFilingIds: string[];
  manuallyCancelledFilingIds: string[];
}

@Injectable()
export class ClientRegistrationsService {
  private readonly logger: ContextLogger;

  constructor(
    @Inject('ENTITY_SERVICE_client-registrations') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly filingsCancellation: ComplianceFilingsCancellationService,
    private readonly rules: ComplianceRulesService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ClientRegistrationsService.name);
  }

  // ---- CRUD delegates (vendors template) -----------------------------------

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateClientRegistrationDto, actorId: string) {
    await this.assertHandlerResolvable(input.lawId, input.clientId);
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateClientRegistrationDto, actorId: string, accessCtx?: DataAccessContext) {
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

  // ---- Domain verbs --------------------------------------------------------

  async register(clientId: string, lawId: string): Promise<ClientRegistration> {
    await this.assertHandlerResolvable(lawId, clientId);
    const existing = await this.findActive(clientId, lawId);
    if (existing) {
      throw new ConflictException(`Client ${clientId} is already registered for law ${lawId}`);
    }
    const [row] = await this.database.db
      .insert(complianceClientRegistrations)
      .values({ clientId, lawId })
      .returning();
    return this.toRegistration(row);
  }

  /**
   * Register a client against multiple laws by code in a single transaction.
   * Idempotent — codes that already map to an active registration are
   * returned untouched (no throw), so the drawer can retry on network flakes
   * and the seeder can re-run safely. Unknown codes reject the entire batch
   * with BadRequestException; callers should validate codes client-side.
   *
   * Emits `client-registrations.Created` once per newly-inserted row after
   * the transaction commits. Already-active registrations do not re-emit.
   */
  async registerMany(
    clientId: string,
    lawCodes: string[],
    actorId: string | null = null,
  ): Promise<ClientRegistration[]> {
    if (lawCodes.length === 0) return [];

    const uniqueCodes = Array.from(new Set(lawCodes));
    const laws = await this.database.db
      .select({ id: complianceLaws.id, code: complianceLaws.code })
      .from(complianceLaws)
      .where(inArray(complianceLaws.code, uniqueCodes));

    const foundCodes = new Set(laws.map((l) => l.code));
    const unknown = uniqueCodes.filter((c) => !foundCodes.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown law code(s): ${unknown.join(', ')}`);
    }

    for (const law of laws) {
      await this.assertHandlerResolvable(law.id, clientId);
    }

    const outcomes = await this.database.db.transaction(async (tx) => {
      const results: Array<{
        row: typeof complianceClientRegistrations.$inferSelect;
        inserted: boolean;
      }> = [];
      for (const law of laws) {
        const [existing] = await tx
          .select()
          .from(complianceClientRegistrations)
          .where(
            and(
              eq(complianceClientRegistrations.clientId, clientId),
              eq(complianceClientRegistrations.lawId, law.id),
              isNull(complianceClientRegistrations.deactivatedAt),
            ),
          );
        if (existing) {
          results.push({ row: existing, inserted: false });
          continue;
        }
        const [inserted] = await tx
          .insert(complianceClientRegistrations)
          .values({ clientId, lawId: law.id })
          .returning();
        results.push({ row: inserted, inserted: true });
      }
      return results;
    });

    for (const { row, inserted } of outcomes) {
      if (!inserted) continue;
      this.events.emitDynamic(CLIENT_REGISTRATIONS_CREATED, {
        entityType: 'client-registrations',
        entityId: row.id,
        actorId,
        payload: { after: row as unknown as Record<string, unknown> },
      });
    }

    return outcomes.map(({ row }) => this.toRegistration(row));
  }

  /**
   * Dry-run of deactivation for the UI dialog (I7). Returns the counts of
   * non-terminal filings split by whether they'd be auto-cancelled
   * (periodStart > deactivatedAt) or left open (periodStart <= deactivatedAt).
   * No writes. The `also cancel earlier` checkbox in the UI is built around
   * `remainingBefore` — that's the count it operates on. Past-or-today
   * constraint enforced here so callers hit the same validation whether they
   * reach via controller or any future internal path.
   */
  async previewDeactivation(
    clientId: string,
    lawId: string,
    deactivatedAt: Date,
  ): Promise<DeactivationPreview> {
    this.assertPastOrPresent(deactivatedAt);
    const existing = await this.findActive(clientId, lawId);
    if (!existing) {
      throw new NotFoundException(`No active registration for client ${clientId} law ${lawId}`);
    }

    const deactivatedOn = toDateString(deactivatedAt);
    const [afterRow] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(and(
        eq(complianceFilings.clientId, clientId),
        eq(complianceFilings.lawId, lawId),
        not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
        gt(complianceFilings.periodStart, deactivatedOn),
      ));
    const [beforeRow] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(and(
        eq(complianceFilings.clientId, clientId),
        eq(complianceFilings.lawId, lawId),
        not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
        lte(complianceFilings.periodStart, deactivatedOn),
      ));

    return {
      registrationId: existing.id,
      deactivatedAt: deactivatedAt.toISOString(),
      cancelledAfter: Number(afterRow?.count ?? 0),
      remainingBefore: Number(beforeRow?.count ?? 0),
    };
  }

  /**
   * Deactivate a registration (I4/I5, Q8). Semantics:
   *
   *   - `deactivatedAt` is past-or-today (V1 constraint from Q8). The admin
   *     picks it; we don't quietly coerce to `new Date()`.
   *   - Non-terminal filings with `periodStart > deactivatedAt` are always
   *     auto-cancelled (the registration contractually ended before those
   *     periods started — the firm has no obligation to file).
   *   - Non-terminal filings with `periodStart <= deactivatedAt` are only
   *     cancelled if the admin opts in via `alsoCancelEarlier`. These
   *     represent work the firm may still owe for periods the registration
   *     was valid; default is to preserve them.
   *   - Both subsets, when cancelled, get a workflow_transition_history row
   *     (distinct `reason` per path so the audit trail reconstructs intent).
   *   - One `compliance.RegistrationDeactivated` event after commit carrying
   *     both id lists so listeners can distinguish the two paths.
   *
   * All of the above runs in one tx — the registration flip and every filing
   * cancellation succeed or fail together.
   */
  async deactivate(
    clientId: string,
    lawId: string,
    params: {
      deactivatedAt: Date;
      alsoCancelEarlier?: boolean;
      actorId: string | null;
      comment?: string;
    },
  ): Promise<DeactivationResult> {
    this.assertPastOrPresent(params.deactivatedAt);

    const existing = await this.findActive(clientId, lawId);
    if (!existing) {
      throw new NotFoundException(`No active registration for client ${clientId} law ${lawId}`);
    }

    const deactivatedOn = toDateString(params.deactivatedAt);
    const alsoCancelEarlier = params.alsoCancelEarlier ?? false;

    const { autoCancelledIds, manuallyCancelledIds } = await this.database.db.transaction(async (tx) => {
      await tx
        .update(complianceClientRegistrations)
        .set({ deactivatedAt: params.deactivatedAt })
        .where(eq(complianceClientRegistrations.id, existing.id));

      const afterFilings = await tx
        .select({ id: complianceFilings.id, status: complianceFilings.status })
        .from(complianceFilings)
        .where(and(
          eq(complianceFilings.clientId, clientId),
          eq(complianceFilings.lawId, lawId),
          not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
          gt(complianceFilings.periodStart, deactivatedOn),
        ));

      const beforeFilings = alsoCancelEarlier
        ? await tx
            .select({ id: complianceFilings.id, status: complianceFilings.status })
            .from(complianceFilings)
            .where(and(
              eq(complianceFilings.clientId, clientId),
              eq(complianceFilings.lawId, lawId),
              not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
              lte(complianceFilings.periodStart, deactivatedOn),
            ))
        : [];

      await this.filingsCancellation.cancelFilings(tx, afterFilings, {
        reason: REASON_AUTO_CANCELLED,
        comment: this.buildComment(deactivatedOn, params.comment, false),
        actorId: params.actorId,
      });
      await this.filingsCancellation.cancelFilings(tx, beforeFilings, {
        reason: REASON_MANUALLY_CANCELLED,
        comment: this.buildComment(deactivatedOn, params.comment, true),
        actorId: params.actorId,
      });

      return {
        autoCancelledIds: afterFilings.map((f) => f.id),
        manuallyCancelledIds: beforeFilings.map((f) => f.id),
      };
    });

    this.logger.log('Registration deactivated', {
      registrationId: existing.id,
      clientId,
      lawId,
      deactivatedAt: deactivatedOn,
      autoCancelledCount: autoCancelledIds.length,
      manuallyCancelledCount: manuallyCancelledIds.length,
    });

    this.events.emitDynamic(COMPLIANCE_REGISTRATION_DEACTIVATED, {
      entityType: 'client-registrations',
      entityId: existing.id,
      actorId: params.actorId,
      payload: {
        registrationId: existing.id,
        clientId,
        lawId,
        deactivatedAt: params.deactivatedAt.toISOString(),
        comment: params.comment ?? null,
        autoCancelledFilingIds: autoCancelledIds,
        manuallyCancelledFilingIds: manuallyCancelledIds,
      },
    });

    return {
      registrationId: existing.id,
      deactivatedAt: params.deactivatedAt.toISOString(),
      autoCancelledFilingIds: autoCancelledIds,
      manuallyCancelledFilingIds: manuallyCancelledIds,
    };
  }

  private buildComment(deactivatedOn: string, adminComment: string | undefined, alsoCancelEarlier: boolean): string {
    const prefix = alsoCancelEarlier
      ? `Cancelled with registration deactivation cleanup (admin opted in) on ${deactivatedOn}.`
      : `Auto-cancelled: registration deactivated on ${deactivatedOn}.`;
    return adminComment ? `${prefix} ${adminComment}` : prefix;
  }

  private assertPastOrPresent(deactivatedAt: Date): void {
    if (deactivatedAt.getTime() > Date.now()) {
      throw new BadRequestException('deactivatedAt must be past or today');
    }
  }

  /**
   * All registrations for the given law whose client is currently `active`,
   * **including recently-deactivated registrations** so the generator (I6,
   * Q8) can make a per-period inclusion decision: a registration deactivated
   * 2026-03-01 should still generate filings for periods starting on or
   * before that date, because the firm was contractually engaged for those
   * periods.
   *
   * The client.status filter stays (I2, Q6) — dormant / onboarding clients
   * are excluded entirely because dormancy is aggressive (cancel everything)
   * and there's no per-period case to preserve.
   *
   * UI callers that want "who is registered right now" should keep using
   * {@link getRegisteredClients}.
   */
  async getRegistrationsForLaw(lawId: string): Promise<ClientRegistration[]> {
    const rows = await this.database.db
      .select({ registration: complianceClientRegistrations })
      .from(complianceClientRegistrations)
      .innerJoin(clients, eq(clients.id, complianceClientRegistrations.clientId))
      .where(
        and(
          eq(complianceClientRegistrations.lawId, lawId),
          eq(clients.status, 'active'),
        ),
      );
    return rows.map((r) => this.toRegistration(r.registration));
  }

  /**
   * Active registrations for the given law, filtered down to clients whose
   * own status is `active`. Dormant / onboarding clients are excluded so the
   * generator (I2/Q6) never materialises filings for a client the firm has
   * stopped actively serving — the dormancy cascade already cancels any
   * in-flight filings at transition time, but the generator still runs on a
   * horizon and would otherwise keep re-creating them.
   */
  async getRegisteredClients(lawId: string): Promise<ClientRegistration[]> {
    const rows = await this.database.db
      .select({ registration: complianceClientRegistrations })
      .from(complianceClientRegistrations)
      .innerJoin(clients, eq(clients.id, complianceClientRegistrations.clientId))
      .where(
        and(
          eq(complianceClientRegistrations.lawId, lawId),
          isNull(complianceClientRegistrations.deactivatedAt),
          eq(clients.status, 'active'),
        ),
      );
    return rows.map((r) => this.toRegistration(r.registration));
  }

  /** Active registrations only. */
  async getRegisteredLaws(clientId: string): Promise<ClientRegistration[]> {
    const rows = await this.database.db
      .select()
      .from(complianceClientRegistrations)
      .where(
        and(
          eq(complianceClientRegistrations.clientId, clientId),
          isNull(complianceClientRegistrations.deactivatedAt),
        ),
      );
    return rows.map((r) => this.toRegistration(r));
  }

  /**
   * I20 guard: rejects registration creation when no team can be resolved as
   * the assignee for the given (law, client). Runs upstream of every create
   * path — `create()`, `register()`, and `registerMany()` — so the rejection
   * surfaces consistently regardless of whether the request hits the generic
   * CRUD endpoint or a domain verb.
   *
   * Passes `clientId` so client-specific handlers (tier 1/2) can satisfy the
   * predicate even when no global default is configured. The opposite flow —
   * where a global handler exists but the client-specific tier is ambiguous —
   * is also caught: `canResolveAssignee` treats ambiguity as not-resolvable
   * because filing generation would otherwise throw at assignment time.
   */
  private async assertHandlerResolvable(lawId: string, clientId: string): Promise<void> {
    const ok = await this.rules.canResolveAssignee(lawId, clientId);
    if (!ok) throw new NoResolvableAssigneeError(lawId);
  }

  private async findActive(clientId: string, lawId: string): Promise<ClientRegistration | null> {
    const rows = await this.database.db
      .select()
      .from(complianceClientRegistrations)
      .where(
        and(
          eq(complianceClientRegistrations.clientId, clientId),
          eq(complianceClientRegistrations.lawId, lawId),
          isNull(complianceClientRegistrations.deactivatedAt),
        ),
      );
    return rows[0] ? this.toRegistration(rows[0]) : null;
  }

  private toRegistration(row: typeof complianceClientRegistrations.$inferSelect): ClientRegistration {
    return {
      id: row.id,
      clientId: row.clientId,
      lawId: row.lawId,
      registeredAt: row.registeredAt,
      deactivatedAt: row.deactivatedAt,
    };
  }
}
