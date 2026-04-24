import { Inject, Injectable } from '@nestjs/common';
import { DomainEventEmitter } from '@packages/events';
import { EntityService } from '@packages/entity-engine';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type {
  ActionHandler,
  ActionContext,
  ActionResult,
  UserSlotDefinition,
} from '@packages/automation-contracts';

import { ComplianceRuleService, type Occurrence } from '../rules/compliance-rules.service';
import { ClientRegistrationsService } from '../client-registrations/client-registrations.service';
import { ComplianceFilingsLookupService } from '../compliance-filings/compliance-filings-lookup.service';
import { buildFilingExternalKey } from '../compliance-filings/compliance-filings.config';
import { COMPLIANCE_FILING_GENERATED } from '../events/types';

const HORIZON_MONTHS = 6;

/**
 * Generates compliance filings for active rules and their registered clients
 * over a fixed horizon. Delegates row writes to the entity-engine's
 * EntityService for compliance-filings — which handles CRUD + audit + generic
 * events (compliance-filings.Created) + soft-delete in one place.
 *
 * Keeps two domain-specific concerns on top:
 *   - idempotency via `findByRuleClientPeriod` (the natural-key guard, cheap
 *     enough to run per-occurrence) so retries + re-runs are safe
 *   - emission of `COMPLIANCE_FILING_GENERATED` on top of the generic
 *     compliance-filings.Created event, so listeners that care about the
 *     compliance projection (rule/client/law/period/dueDate) can subscribe
 *     once without parsing generic entity payloads
 */
@Injectable()
export class GenerateComplianceFilingsAction implements ActionHandler {
  readonly type = 'generate_compliance_filings';
  readonly label = 'Generate Compliance Filings';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {};

  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: ComplianceRuleService,
    private readonly clientRegistrationService: ClientRegistrationsService,
    private readonly lookup: ComplianceFilingsLookupService,
    @Inject('ENTITY_SERVICE_compliance-filings')
    private readonly filings: EntityService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(GenerateComplianceFilingsAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const ruleId = context.event?.entityId ?? context.entityId;
    if (!ruleId) {
      this.logger.warn('No rule id in action context — skipping');
      return {};
    }

    const rule = await this.ruleService.findById(ruleId);
    if (!rule || rule.status === 'deprecated') {
      this.logger.debug('Rule not found or deprecated — skipping', { ruleId });
      return {};
    }

    // Include recently-deactivated registrations: per I6/Q8, a registration
    // deactivated 2026-03-01 still owes filings for periods starting on or
    // before that date. Per-occurrence filter below decides inclusion.
    const registrations = await this.clientRegistrationService.getRegistrationsForLaw(rule.lawId);
    if (registrations.length === 0) {
      this.logger.debug('No registered clients for rule — skipping', { ruleId, lawId: rule.lawId });
      return {};
    }

    const now = new Date();
    const horizonEnd = this.addMonths(now, HORIZON_MONTHS);
    const occurrences = this.ruleService.expandRule(rule, now, horizonEnd);

    let created = 0;
    for (const reg of registrations) {
      for (const occ of occurrences) {
        const periodStart = this.toIsoDate(occ.periodStart);

        // I6: `deactivatedAt IS NULL OR deactivatedAt > periodStart`. A
        // registration deactivated on or before this period started has no
        // further obligation for this period.
        if (reg.deactivatedAt && this.toIsoDate(reg.deactivatedAt) <= periodStart) continue;

        const existing = await this.lookup.findByRuleClientPeriod(rule.id, reg.clientId, periodStart);
        if (existing) continue;

        const assigneeOrgId = await this.ruleService.resolveAssignee(rule.lawId, reg.clientId);
        const periodEnd = this.toIsoDate(occ.periodEnd);
        const dueDate = this.toIsoDate(occ.dueDate);

        const row = await this.filings.create(
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

        this.events.emitDynamic(COMPLIANCE_FILING_GENERATED, {
          entityType: 'compliance_rules',
          entityId: rule.id,
          actorId: null,
          payload: {
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            filingId: row.id as string,
            externalKey: (row.externalKey as string | undefined)
              ?? buildFilingExternalKey(rule.id, reg.clientId, periodStart),
            periodStart,
            periodEnd,
            dueDate,
          },
        });

        created += 1;
      }
    }

    this.logger.log('Compliance filing generation complete', { ruleId, created });
    return {};
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
