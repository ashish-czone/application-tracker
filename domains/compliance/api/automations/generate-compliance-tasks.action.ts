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

import { ComplianceRulesService, type Occurrence } from '../rules/compliance-rules.service';
import { ClientRegistrationsService } from '../client-registrations/client-registrations.service';
import { ComplianceTasksLookupService } from '../compliance-tasks/compliance-tasks-lookup.service';
import { buildComplianceExternalKey } from '../compliance-tasks/compliance-tasks.config';
import { COMPLIANCE_TASK_GENERATED } from '../events/types';

const HORIZON_MONTHS = 6;

/**
 * Generates compliance-tasks for active rules and their registered clients
 * over a fixed horizon. Delegates the actual row writes to the platform
 * EntityService — which transactionally handles the parent tasks insert +
 * the compliance_tasks extension insert via the `extensionOf` primitive.
 *
 * The action keeps two domain-specific bits on top of EntityService:
 *   - idempotency via `findByRuleClientPeriod` (the natural-key guard)
 *   - emission of `COMPLIANCE_TASK_GENERATED`, the domain event consumers
 *     subscribe to. entity-engine already fires `compliance-tasks.Created`
 *     via the generic CRUD stream; this extra event carries the compliance
 *     projection (rule/client/law/period/dueDate) that listeners need.
 */
@Injectable()
export class GenerateComplianceTasksAction implements ActionHandler {
  readonly type = 'generate_compliance_tasks';
  readonly label = 'Generate Compliance Tasks';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {};

  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: ComplianceRulesService,
    private readonly clientRegistrationService: ClientRegistrationsService,
    private readonly lookup: ComplianceTasksLookupService,
    @Inject('ENTITY_SERVICE_compliance-tasks')
    private readonly complianceTasks: EntityService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(GenerateComplianceTasksAction.name);
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

    const registrations = await this.clientRegistrationService.getRegisteredClients(rule.lawId);
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

        const existing = await this.lookup.findByRuleClientPeriod(rule.id, reg.clientId, periodStart);
        if (existing) continue;

        const assigneeOrgId = await this.ruleService.resolveAssignee(rule.lawId, reg.clientId);
        const periodEnd = this.toIsoDate(occ.periodEnd);
        const dueDate = this.toIsoDate(occ.dueDate);

        const row = await this.complianceTasks.create(
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

        this.events.emitDynamic(COMPLIANCE_TASK_GENERATED, {
          entityType: 'compliance-rules',
          entityId: rule.id,
          actorId: null,
          payload: {
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            taskId: row.id as string,
            externalKey: (row.externalKey as string | undefined)
              ?? buildComplianceExternalKey(rule.id, reg.clientId, periodStart),
            periodStart,
            periodEnd,
            dueDate,
          },
        });

        created += 1;
      }
    }

    this.logger.log('Compliance task generation complete', { ruleId, created });
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
