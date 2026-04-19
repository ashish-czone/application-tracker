import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type {
  ActionHandler,
  ActionContext,
  ActionResult,
  UserSlotDefinition,
} from '@packages/automation-contracts';

import { ComplianceRuleService, type Occurrence } from '../rules/compliance-rules.service';
import { ClientRegistrationService } from '../client-registrations/client-registrations.service';
import { ComplianceTasksService } from '../compliance-tasks/compliance-tasks.service';

const HORIZON_MONTHS = 6;

@Injectable()
export class GenerateComplianceTasksAction implements ActionHandler {
  readonly type = 'generate_compliance_tasks';
  readonly label = 'Generate Compliance Tasks';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {};

  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: ComplianceRuleService,
    private readonly clientRegistrationService: ClientRegistrationService,
    private readonly complianceTasksService: ComplianceTasksService,
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
    if (!rule || !rule.active) {
      this.logger.debug('Rule not found or inactive — skipping', { ruleId });
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

        const existing = await this.complianceTasksService.findByRuleClientPeriod(
          rule.id,
          reg.clientId,
          periodStart,
        );
        if (existing) continue;

        const assigneeOrgId = await this.ruleService.resolveAssignee(rule.lawId, reg.clientId);

        await this.complianceTasksService.create(
          {
            title: this.buildTitle(rule.name, occ),
            dueDate: this.toIsoDate(occ.dueDate),
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            periodStart,
            periodEnd: this.toIsoDate(occ.periodEnd),
            assigneeTeamId: assigneeOrgId,
          },
          'system',
        );
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
