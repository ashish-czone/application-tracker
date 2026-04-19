import type { INestApplicationContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TasksService, tasks } from '@packages/tasks';
import { DatabaseService, eq, users } from '@packages/database';
import { ComplianceRuleService } from '../../rules/compliance-rules.service';
import { ClientRegistrationService } from '../../client-registrations/client-registrations.service';

/**
 * Mirrors `GenerateComplianceTasksAction` so seeding is not tied to the
 * automation runner. For every active rule × registered client × occurrence
 * in the next `HORIZON_MONTHS` months, materializes a task. Idempotent via
 * the external key (rule + client + period start).
 */
const HORIZON_MONTHS = 6;
const TASK_KIND = 'compliance';

interface TaskEntityService {
  create(data: Record<string, unknown>, actorId: string): Promise<{ id: string; [k: string]: unknown }>;
}

export const seedDemoTasks = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const ruleService = ctx.get(ComplianceRuleService);
  const registrationService = ctx.get(ClientRegistrationService);
  const tasksService = ctx.get(TasksService);
  const moduleRef = ctx.get(ModuleRef);

  // Idempotency: presence of any compliance-rule-linked task short-circuits.
  const existing = await database.db
    .select({ id: tasks.id })
    .from(tasks)
    .limit(1);
  if (existing[0]) return;

  const tasksEntityService = moduleRef.get<TaskEntityService>('ENTITY_SERVICE_tasks', {
    strict: false,
  });
  if (!tasksEntityService) return;

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
        const externalKey = buildExternalKey(rule.id, reg.clientId, occ.periodStart);
        const found = await tasksService.findByExternalKey(TASK_KIND, rule.id, externalKey);
        if (found) continue;

        await tasksEntityService.create(
          {
            title: `${rule.name} — ${toIsoDate(occ.periodStart)} to ${toIsoDate(occ.periodEnd)}`,
            dueDate: toIsoDate(occ.dueDate),
            priority: 'medium',
            assigneeTeamId: assigneeOrgId,
            kind: TASK_KIND,
            relatedEntityId: rule.id,
            externalKey,
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

function buildExternalKey(ruleId: string, clientId: string, periodStart: Date): string {
  return `${ruleId}:${clientId}:${toIsoDate(periodStart)}`;
}

function addMonths(from: Date, n: number): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + n, from.getUTCDate()),
  );
}
