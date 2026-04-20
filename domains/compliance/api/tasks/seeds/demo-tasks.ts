import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { EntityService } from '@packages/entity-engine';
import { complianceTasks } from '../../schema/compliance-tasks';
import { ComplianceRuleService } from '../../rules/compliance-rules.service';
import { ClientRegistrationService } from '../../client-registrations/client-registrations.service';
import { ComplianceTasksLookupService } from '../../compliance-tasks/compliance-tasks-lookup.service';
import { buildComplianceExternalKey } from '../../compliance-tasks/compliance-tasks.config';
import { COMPLIANCE_TASK_GENERATED } from '../../events/types';

/**
 * Mirrors `GenerateComplianceTasksAction` so seeding is not tied to the
 * automation runner. For every active rule × registered client × occurrence
 * in the next `HORIZON_MONTHS` months, materializes a compliance task via
 * the generic EntityService<compliance-tasks>. Idempotent via
 * findByRuleClientPeriod.
 */
const HORIZON_MONTHS = 6;

export const seedDemoTasks = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const ruleService = ctx.get(ComplianceRuleService);
  const registrationService = ctx.get(ClientRegistrationService);
  const lookup = ctx.get(ComplianceTasksLookupService);
  const entityService = ctx.get<EntityService>('ENTITY_SERVICE_compliance-tasks');
  const events = ctx.get(DomainEventEmitter);

  // Idempotency short-circuit: if any compliance task already exists, skip.
  const existing = await database.db
    .select({ taskId: complianceTasks.taskId })
    .from(complianceTasks)
    .limit(1);
  if (existing[0]) return;

  const [admin] = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'admin@admin.com'))
    .limit(1);
  if (!admin) return;

  const activeRules = await ruleService.findActive();
  if (activeRules.length === 0) return;

  const now = new Date();
  const horizonEnd = addMonths(now, HORIZON_MONTHS);

  for (const rule of activeRules) {
    const registrations = await registrationService.getRegisteredClients(rule.lawId);
    if (registrations.length === 0) continue;

    const occurrences = ruleService.expandRule(rule, now, horizonEnd);
    if (occurrences.length === 0) continue;

    for (const reg of registrations) {
      let assigneeOrgId: string;
      try {
        assigneeOrgId = await ruleService.resolveAssignee(rule.lawId, reg.clientId);
      } catch {
        continue;
      }

      for (const occ of occurrences) {
        const periodStart = toIsoDate(occ.periodStart);
        const found = await lookup.findByRuleClientPeriod(rule.id, reg.clientId, periodStart);
        if (found) continue;

        const periodEnd = toIsoDate(occ.periodEnd);
        const dueDate = toIsoDate(occ.dueDate);

        const row = await entityService.create(
          {
            title: `${rule.name} — ${periodStart} to ${periodEnd}`,
            dueDate,
            priority: 'medium',
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            periodStart,
            periodEnd,
            assigneeTeamId: assigneeOrgId,
          },
          admin.id,
        );

        events.emitDynamic(COMPLIANCE_TASK_GENERATED, {
          entityType: 'compliance_rules',
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
      }
    }
  }
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(from: Date, n: number): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + n, from.getUTCDate()),
  );
}
