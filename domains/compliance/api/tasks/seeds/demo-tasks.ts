import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, users } from '@packages/database';
import { complianceTasks } from '../../schema/compliance-tasks';
import { ComplianceRuleService } from '../../rules/compliance-rules.service';
import { ClientRegistrationService } from '../../client-registrations/client-registrations.service';
import { ComplianceTasksService } from '../../compliance-tasks/compliance-tasks.service';

/**
 * Mirrors `GenerateComplianceTasksAction` so seeding is not tied to the
 * automation runner. For every active rule × registered client × occurrence
 * in the next `HORIZON_MONTHS` months, materializes a compliance task via
 * `ComplianceTasksService.create` (transactional write to tasks +
 * compliance_tasks). Idempotent via findByRuleClientPeriod.
 */
const HORIZON_MONTHS = 6;

export const seedDemoTasks = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const ruleService = ctx.get(ComplianceRuleService);
  const registrationService = ctx.get(ClientRegistrationService);
  const complianceTasksService = ctx.get(ComplianceTasksService);

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
        const found = await complianceTasksService.findByRuleClientPeriod(
          rule.id,
          reg.clientId,
          periodStart,
        );
        if (found) continue;

        await complianceTasksService.create(
          {
            title: `${rule.name} — ${periodStart} to ${toIsoDate(occ.periodEnd)}`,
            dueDate: toIsoDate(occ.dueDate),
            priority: 'medium',
            ruleId: rule.id,
            clientId: reg.clientId,
            lawId: rule.lawId,
            periodStart,
            periodEnd: toIsoDate(occ.periodEnd),
            assigneeTeamId: assigneeOrgId,
          },
          admin.id,
        );
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
