import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, asc, eq, users } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { EntityService } from '@packages/entity-engine';
import { complianceFilings } from '../../schema/compliance-filings';
import { ComplianceRuleService } from '../../rules/compliance-rules.service';
import { ClientRegistrationsService } from '../../client-registrations/client-registrations.service';
import { ComplianceFilingsLookupService } from '../compliance-filings-lookup.service';
import { buildFilingExternalKey } from '../compliance-filings.config';
import { COMPLIANCE_FILING_GENERATED } from '../../events/types';

/**
 * Mirrors `GenerateComplianceFilingsAction` so seeding is not tied to the
 * automation runner. For every active rule × registered client × occurrence
 * in the next `HORIZON_MONTHS` months, materializes a filing via the generic
 * EntityService<compliance-filings>. Idempotent via findByRuleClientPeriod.
 *
 * After bulk generation, spreads the first 30 filings across a
 * due-date/assignment range so dashboard widgets have data in the
 * overdue / due-today / due-this-week / upcoming buckets on a fresh seed.
 */
const HORIZON_MONTHS = 6;

export const seedDemoFilings = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const ruleService = ctx.get(ComplianceRuleService);
  const registrationService = ctx.get(ClientRegistrationsService);
  const lookup = ctx.get(ComplianceFilingsLookupService);
  const entityService = ctx.get<EntityService>('ENTITY_SERVICE_compliance-filings');
  const events = ctx.get(DomainEventEmitter);

  // Idempotency short-circuit: if any filing exists, skip.
  const existing = await database.db
    .select({ id: complianceFilings.id })
    .from(complianceFilings)
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

        events.emitDynamic(COMPLIANCE_FILING_GENERATED, {
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
      }
    }
  }

  // Demo variety: spread the first N filings across overdue / due-today /
  // due-this-week / upcoming buckets, and individually assign every third
  // filing to admin so the "assigned to me" widgets are populated.
  const SPREAD_LIMIT = 30;
  const DUE_OFFSETS = [-14, -10, -7, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
  const spread = await database.db
    .select({ id: complianceFilings.id })
    .from(complianceFilings)
    .orderBy(asc(complianceFilings.createdAt))
    .limit(SPREAD_LIMIT);

  for (let i = 0; i < spread.length; i++) {
    const dayOffset = DUE_OFFSETS[i % DUE_OFFSETS.length]!;
    const demoDue = toIsoDate(addDays(now, dayOffset));
    const assignToAdmin = i % 3 === 0;
    await database.db
      .update(complianceFilings)
      .set({
        dueDate: demoDue,
        ...(assignToAdmin ? { assigneeId: admin.id } : {}),
      })
      .where(eq(complianceFilings.id, spread[i]!.id));
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

function addDays(from: Date, n: number): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + n),
  );
}
