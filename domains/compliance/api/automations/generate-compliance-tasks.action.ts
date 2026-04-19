import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DomainEventEmitter } from '@packages/events';
import { TasksService } from '@packages/tasks';
import type {
  ActionHandler,
  ActionContext,
  ActionResult,
  UserSlotDefinition,
} from '@packages/automation-contracts';

import { ComplianceRuleService, type ComplianceRule, type Occurrence } from '../rules/compliance-rules.service';
import { ClientRegistrationService } from '../client-registrations/client-registrations.service';
import { COMPLIANCE_TASK_GENERATED } from '../events/types';

interface TaskEntityService {
  create(
    data: Record<string, unknown>,
    actorId: string,
  ): Promise<{ id: string; [k: string]: unknown }>;
}

const HORIZON_MONTHS = 6;
const TASK_KIND = 'compliance';

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
    private readonly tasksService: TasksService,
    private readonly events: DomainEventEmitter,
    private readonly moduleRef: ModuleRef,
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

    const tasksEntityService = this.getTasksEntityService();
    if (!tasksEntityService) {
      this.logger.error('Tasks EntityService not registered — cannot generate compliance tasks');
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
        const externalKey = this.buildExternalKey(rule.id, reg.clientId, occ.periodStart);

        const existing = await this.tasksService.findByExternalKey(
          TASK_KIND,
          rule.id,
          externalKey,
        );
        if (existing) continue;

        const assigneeOrgId = await this.ruleService.resolveAssignee(rule.lawId, reg.clientId);

        const task = await tasksEntityService.create(
          {
            title: this.buildTitle(rule.name, occ),
            dueDate: this.toIsoDate(occ.dueDate),
            assigneeTeamId: assigneeOrgId,
            kind: TASK_KIND,
            relatedEntityId: rule.id,
            externalKey,
          },
          'system',
        );

        this.events.emitDynamic(COMPLIANCE_TASK_GENERATED, {
          entityType: 'compliance_rule',
          entityId: rule.id,
          actorId: null,
          payload: {
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            taskId: task.id,
            externalKey,
            periodStart: this.toIsoDate(occ.periodStart),
            periodEnd: this.toIsoDate(occ.periodEnd),
            dueDate: this.toIsoDate(occ.dueDate),
          },
        });
        created += 1;
      }
    }

    this.logger.log('Compliance task generation complete', { ruleId, created });
    return {};
  }

  private buildExternalKey(ruleId: string, clientId: string, periodStart: Date): string {
    return `${ruleId}:${clientId}:${this.toIsoDate(periodStart)}`;
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

  private getTasksEntityService(): TaskEntityService | null {
    try {
      return this.moduleRef.get<TaskEntityService>('ENTITY_SERVICE_tasks', { strict: false });
    } catch {
      return null;
    }
  }
}
