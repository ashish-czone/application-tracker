import { Inject, Injectable } from '@nestjs/common';
import { DomainEventEmitter } from '@packages/events';
import { EntityService } from '@packages/entity-engine';
import { AppLoggerService, type ContextLogger } from '@packages/logger';

import {
  ComplianceRulesService,
  type ComplianceRule,
  type Occurrence,
} from '../rules/compliance-rules.service';
import {
  ClientRegistrationsService,
  type ClientRegistration,
} from '../client-registrations/client-registrations.service';
import { ComplianceFilingsLookupService } from '../compliance-filings/compliance-filings-lookup.service';
import { buildFilingExternalKey } from '../compliance-filings/compliance-filings.config';
import { COMPLIANCE_FILING_GENERATED } from '../events/types';

/**
 * Stream J / Q11. Single source of truth for compliance-filing materialisation.
 * Three callers compose around this:
 *   1. {@link GenerateComplianceFilingsAction} — automation pull. Existing path
 *      kept thin so the daily cron + ad-hoc rule-scoped runs stay unchanged.
 *   2. Stream J event listeners (rule activation, registration created, client
 *      reactivation) — push path. Each listener calls one of the three public
 *      methods below.
 *   3. Demo seed — uses its own copy of the iteration today; could share later.
 *
 * The generator is idempotent: per-occurrence `findByRuleClientPeriod` skips
 * rows already materialised under any earlier run, so re-runs and overlapping
 * triggers (cron + event) stay safe.
 */
export const HORIZON_MONTHS = 12;

@Injectable()
export class ComplianceFilingsGeneratorService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: ComplianceRulesService,
    private readonly registrationService: ClientRegistrationsService,
    private readonly lookup: ComplianceFilingsLookupService,
    @Inject('ENTITY_SERVICE_compliance-filings')
    private readonly filings: EntityService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ComplianceFilingsGeneratorService.name);
  }

  /**
   * Generate filings for a single rule across every active registration on
   * its law. Used by the automation action and by the J3 listener (rule
   * status flipped to active).
   *
   * @param now Reference instant for horizon math + period filtering. Defaults
   *   to wall-clock; tests pass a deterministic asOf via the test-hooks cron
   *   endpoint so the rolling 12-month horizon and the I6 forward-only filter
   *   are reproducible.
   */
  async generateForRule(ruleId: string, now: Date = new Date()): Promise<{ created: number }> {
    const rule = await this.ruleService.findById(ruleId);
    if (!rule || rule.status === 'deprecated') {
      this.logger.debug('Rule not found or deprecated — skipping', { ruleId });
      return { created: 0 };
    }

    // Include recently-deactivated registrations: per I6/Q8, a registration
    // deactivated 2026-03-01 still owes filings for periods starting on or
    // before that date. The per-occurrence filter inside generateOccurrences
    // decides inclusion.
    const registrations = await this.registrationService.getRegistrationsForLaw(rule.lawId);
    if (registrations.length === 0) {
      this.logger.debug('No registered clients for rule — skipping', {
        ruleId,
        lawId: rule.lawId,
      });
      return { created: 0 };
    }

    const created = await this.generateForPairs(rule, registrations, now);
    this.logger.log('Compliance filing generation complete (per-rule)', { ruleId, created });
    return { created };
  }

  /**
   * Generate filings for a single new registration across every active rule
   * on its law. Used by the J4 listener (registration created).
   */
  async generateForRegistration(
    clientId: string,
    lawId: string,
    now: Date = new Date(),
  ): Promise<{ created: number }> {
    const registrations = await this.registrationService.getRegistrationsForLaw(lawId);
    const target = registrations.find((r) => r.clientId === clientId && !r.deactivatedAt);
    if (!target) {
      this.logger.debug('Active registration not found — skipping', { clientId, lawId });
      return { created: 0 };
    }

    const allRules = await this.ruleService.findActive();
    const rules = allRules.filter((r) => r.lawId === lawId && r.status === 'active');
    if (rules.length === 0) {
      this.logger.debug('No active rules on law — skipping', { lawId });
      return { created: 0 };
    }

    let created = 0;
    for (const rule of rules) {
      created += await this.generateForPairs(rule, [target], now);
    }
    this.logger.log('Compliance filing generation complete (per-registration)', {
      clientId,
      lawId,
      created,
    });
    return { created };
  }

  /**
   * Generate filings for every active registration of a client across every
   * active rule on each registration's law. Used by the J5 listener (client
   * reactivated). Q6 keeps already-cancelled dormancy filings cancelled —
   * they are not regenerated because the per-occurrence idempotency guard
   * matches on (rule, client, periodStart) regardless of status.
   */
  async generateForClient(clientId: string, now: Date = new Date()): Promise<{ created: number }> {
    const registrations = await this.registrationService.getRegisteredLaws(clientId);
    if (registrations.length === 0) {
      this.logger.debug('No active registrations for client — skipping', { clientId });
      return { created: 0 };
    }

    const allRules = await this.ruleService.findActive();
    const rulesByLaw = new Map<string, ComplianceRule[]>();
    for (const rule of allRules) {
      if (rule.status !== 'active') continue;
      const list = rulesByLaw.get(rule.lawId) ?? [];
      list.push(rule);
      rulesByLaw.set(rule.lawId, list);
    }

    let created = 0;
    for (const reg of registrations) {
      const rules = rulesByLaw.get(reg.lawId) ?? [];
      for (const rule of rules) {
        created += await this.generateForPairs(rule, [reg], now);
      }
    }
    this.logger.log('Compliance filing generation complete (per-client)', { clientId, created });
    return { created };
  }

  /**
   * Generate filings across every active rule × every active registration
   * for the horizon. Used by the test-hooks cron endpoint to drive a full
   * generator pass at a deterministic asOf without going through the
   * automations rule scanner.
   */
  async generateAll(now: Date = new Date()): Promise<{ created: number }> {
    const allRules = await this.ruleService.findActive();
    const activeRules = allRules.filter((r) => r.status === 'active');
    if (activeRules.length === 0) return { created: 0 };

    let created = 0;
    for (const rule of activeRules) {
      const registrations = await this.registrationService.getRegistrationsForLaw(rule.lawId);
      if (registrations.length === 0) continue;
      created += await this.generateForPairs(rule, registrations, now);
    }
    this.logger.log('Compliance filing generation complete (full pass)', { created });
    return { created };
  }

  /**
   * Inner loop shared by the public entrypoints. Expands the rule across the
   * horizon, applies the per-occurrence `deactivatedAt` filter, and creates
   * filings via the entity service. Returns the number of new rows written.
   *
   * Per-call work is batched to keep round-trips O(N+M) rather than O(N×M):
   *   - One SELECT pulls every existing `(client, periodStart)` tuple this
   *     pass might collide with — feeds the per-row idempotency check.
   *   - Per-client `resolveAssignee` is memoised against `rule.lawId` since
   *     the assignee is a function of `(law, client)` and doesn't drift
   *     within a single generator run.
   *
   * `isClientActive` is intentionally NOT memoised: the Q6 race guard
   * needs a fresh read each occurrence so a mid-loop `active → dormant`
   * transition stops further generation as soon as it lands. The
   * dormancy cascade's post-commit sweep (`sweepLateFilings`) is the
   * fallback for any rows created in the gap, but the inner check is
   * what makes that gap small.
   *
   * The 23505 race guard around `filings.create` is unchanged: under
   * concurrency the batched lookup may be stale, and the unique index on
   * `(rule_id, client_id, period_start)` is still the source of truth.
   */
  private async generateForPairs(
    rule: ComplianceRule,
    registrations: ClientRegistration[],
    now: Date,
  ): Promise<number> {
    const horizonEnd = this.addMonths(now, HORIZON_MONTHS);
    const occurrences = this.ruleService.expandRule(rule, now, horizonEnd);
    if (registrations.length === 0 || occurrences.length === 0) return 0;

    const clientIds = [...new Set(registrations.map((r) => r.clientId))];
    const periodStarts = occurrences.map((occ) => this.toIsoDate(occ.periodStart));
    const existingKeys = await this.lookup.findExistingKeys(rule.id, clientIds, periodStarts);

    const assigneeCache = new Map<string, string>();
    const resolveAssignee = async (clientId: string): Promise<string> => {
      const cached = assigneeCache.get(clientId);
      if (cached !== undefined) return cached;
      const fresh = await this.ruleService.resolveAssignee(rule.lawId, clientId);
      assigneeCache.set(clientId, fresh);
      return fresh;
    };

    let created = 0;
    for (const reg of registrations) {
      for (const occ of occurrences) {
        const periodStart = this.toIsoDate(occ.periodStart);

        // I6: `deactivatedAt IS NULL OR deactivatedAt > periodStart`. A
        // registration deactivated on or before this period started has no
        // further obligation for this period.
        if (reg.deactivatedAt && this.toIsoDate(reg.deactivatedAt) <= periodStart) continue;

        // Q6 race guard: callers snapshot `getRegistrationsForLaw` at entry,
        // but the client may transition `active → dormant` mid-flight. The
        // dormancy cascade only cancels filings that already exist when its
        // SELECT runs; without an inner check the loop keeps creating fresh
        // pending rows for the now-dormant client. Per-occurrence to stop the
        // moment the next iteration sees the new status — not memoised.
        if (!(await this.registrationService.isClientActive(reg.clientId))) {
          this.logger.debug('Client no longer active — skipping further generation', {
            ruleId: rule.id,
            clientId: reg.clientId,
          });
          break;
        }

        if (existingKeys.has(`${reg.clientId}:${periodStart}`)) continue;

        const assigneeOrgId = await resolveAssignee(reg.clientId);
        const periodEnd = this.toIsoDate(occ.periodEnd);
        const dueDate = this.toIsoDate(occ.dueDate);

        let row: Record<string, unknown>;
        try {
          row = await this.filings.create(
            {
              title: this.buildTitle(rule.name, occ),
              dueDate,
              ruleId: rule.id,
              clientId: reg.clientId,
              lawId: rule.lawId,
              periodStart,
              periodEnd,
              assigneeTeamId: assigneeOrgId,
            },
            'system',
          );
        } catch (error) {
          // The batched `findExistingKeys` snapshot is not safe under
          // concurrency: when the cron run and an event-listener top-up
          // (`generateForRule` / `generateForRegistration` / `generateForClient`)
          // overlap, both transactions can read "no existing row" and race
          // to insert. The unique index on (rule_id, client_id, period_start)
          // serialises the race at the DB layer — the loser sees `23505`.
          // Treat that loser as "raced — already created by the winning
          // path", skip the row, and continue. Any other error (FK
          // violation, NULL violation, different unique index) re-throws.
          if (isRuleClientPeriodRace(error)) {
            this.logger.debug('Filing already created by concurrent path — skipping', {
              ruleId: rule.id,
              clientId: reg.clientId,
              periodStart,
            });
            continue;
          }
          throw error;
        }

        this.events.emitDynamic(COMPLIANCE_FILING_GENERATED, {
          entityType: 'compliance-rules',
          entityId: rule.id,
          actorId: null,
          payload: {
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            filingId: row.id as string,
            externalKey:
              (row.externalKey as string | undefined) ??
              buildFilingExternalKey(rule.id, reg.clientId, periodStart),
            periodStart,
            periodEnd,
            dueDate,
          },
        });

        created += 1;
      }
    }
    return created;
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildTitle(ruleName: string, occurrence: Occurrence): string {
    const start = this.toIsoDate(occurrence.periodStart);
    const end = this.toIsoDate(occurrence.periodEnd);
    return `${ruleName} — ${start} to ${end}`;
  }

  private addMonths(from: Date, n: number): Date {
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth();
    const d = from.getUTCDate();
    return new Date(Date.UTC(y, m + n, d));
  }
}

const FILING_RACE_CONSTRAINT = 'compliance_filings_rule_client_period_key';
const PG_UNIQUE_VIOLATION = '23505';

/**
 * True iff `error` (or any wrapped cause) is the specific Postgres unique
 * violation on the (rule_id, client_id, period_start) index. Drizzle wraps
 * pg's `DatabaseError` inside its own `DrizzleQueryError`, so we walk the
 * `cause` chain rather than only inspecting the top-level error.
 */
function isRuleClientPeriodRace(error: unknown): boolean {
  let cursor: unknown = error;
  while (cursor) {
    const e = cursor as { code?: string; constraint?: string; cause?: unknown };
    if (e.code === PG_UNIQUE_VIOLATION && e.constraint === FILING_RACE_CONSTRAINT) {
      return true;
    }
    cursor = e.cause;
  }
  return false;
}
