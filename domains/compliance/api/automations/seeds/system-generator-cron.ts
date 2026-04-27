import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { AutomationRuleService } from '@packages/automations';

/**
 * Stream J / Q12 — daily cron that materialises compliance filings.
 *
 * Wires through the automations addon's schedule scanner: the rule fires
 * once a day at the configured hour in APP_TIMEZONE, iterating every
 * `compliance-rules` row whose `status === 'active'` and invoking the
 * `generate_compliance_filings` action per rule. The action delegates to
 * `ComplianceFilingsGeneratorService.generateForRule(ruleId)`, which is
 * idempotent (per-occurrence findByRuleClientPeriod), so overlap with the
 * J3-J5 event listeners is safe.
 *
 * **Why low-traffic hour:** `scheduleHour: 2` puts the daily run at 2am
 * APP_TIMEZONE, the same convention used by the automations addon's own
 * `DEFAULT_SCHEDULE_HOUR`. Heavy iteration (every active rule × every
 * registered client × every horizon period) doesn't compete with daytime
 * request load.
 *
 * **Why system seed:** without this rule, the rolling 12-month horizon
 * never advances — filings would still be created on rule activation /
 * registration creation / client reactivation (Stream J event listeners),
 * but the natural calendar tick (next month's filings, next quarter's,
 * etc.) would silently fall behind. The cron is a load-bearing safety net.
 */
const RULE_NAME = 'compliance-filings-daily-generator';

export const seedComplianceGeneratorCron = async (
  ctx: INestApplicationContext,
): Promise<void> => {
  const ruleService = ctx.get(AutomationRuleService);
  const logger: LoggerService = new Logger('seedComplianceGeneratorCron');

  const existing = await ruleService.findFirstByName(RULE_NAME);
  if (existing) {
    logger.log?.('Compliance generator cron already seeded — skipping');
    return;
  }

  await ruleService.create({
    name: RULE_NAME,
    description:
      'Daily cron that runs the compliance filings generator across every active rule. Keeps the 12-month materialisation horizon rolling forward; safe to overlap with the Stream J event listeners thanks to per-occurrence idempotency.',
    triggerType: 'schedule_recurring',
    scheduleEntityType: 'compliance-rules',
    scheduleHour: 2,
    scheduleDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    conditions: [{ field: 'status', operator: 'eq', value: 'active' }],
    actions: [{ type: 'generate_compliance_filings', config: {} }],
  });

  logger.log?.('Compliance generator cron seeded');
};
