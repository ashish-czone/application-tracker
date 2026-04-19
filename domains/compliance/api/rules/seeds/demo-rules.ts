import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, inArray } from '@packages/database';
import { complianceLaws } from '../../schema/laws';
import { complianceRules } from '../../schema/rules';
import { ComplianceRuleService } from '../compliance-rules.service';

interface DemoRule {
  code: string;
  name: string;
  lawCode: 'GST' | 'ITR' | 'TDS' | 'ROC' | 'PT';
  frequency: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  dueDayOfMonth: number;
  // Months to add to period end before applying dueDayOfMonth.
  dueMonthOffset: number;
  gracePeriodDays: number;
  description: string;
}

const DEMO_RULES: DemoRule[] = [
  {
    code: 'GSTR-1',
    name: 'GSTR-1 — Outward Supplies',
    lawCode: 'GST',
    frequency: 'monthly',
    dueDayOfMonth: 11,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: 'Monthly return of outward supplies. Due 11th of the following month.',
  },
  {
    code: 'GSTR-3B',
    name: 'GSTR-3B — Summary Return',
    lawCode: 'GST',
    frequency: 'monthly',
    dueDayOfMonth: 20,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: 'Monthly self-declared summary return with tax payment. Due 20th of the following month.',
  },
  {
    code: 'GSTR-9',
    name: 'GSTR-9 — Annual Return',
    lawCode: 'GST',
    frequency: 'yearly',
    dueDayOfMonth: 31,
    dueMonthOffset: 9,
    gracePeriodDays: 0,
    description: 'Annual reconciliation return. Due 31 December of the following financial year.',
  },
  {
    code: 'ITR-FILING',
    name: 'Annual Income Tax Return',
    lawCode: 'ITR',
    frequency: 'yearly',
    dueDayOfMonth: 31,
    dueMonthOffset: 4,
    gracePeriodDays: 0,
    description: 'Annual income tax return for non-audit taxpayers. Due 31 July after FY end.',
  },
  {
    code: 'TDS-24Q',
    name: 'TDS Quarterly Return (Salary — Form 24Q)',
    lawCode: 'TDS',
    frequency: 'quarterly',
    dueDayOfMonth: 31,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: 'Quarterly TDS return for salary payments (Form 24Q).',
  },
  {
    code: 'TDS-26Q',
    name: 'TDS Quarterly Return (Non-Salary — Form 26Q)',
    lawCode: 'TDS',
    frequency: 'quarterly',
    dueDayOfMonth: 31,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: 'Quarterly TDS return for payments other than salary (Form 26Q).',
  },
  {
    code: 'ROC-AOC-4',
    name: 'AOC-4 — Annual Financial Statement Filing',
    lawCode: 'ROC',
    frequency: 'yearly',
    dueDayOfMonth: 30,
    dueMonthOffset: 7,
    gracePeriodDays: 0,
    description: 'Filing of annual financial statements with the Registrar of Companies. Due 30 October after FY end.',
  },
  {
    code: 'ROC-MGT-7',
    name: 'MGT-7 — Annual Return Filing',
    lawCode: 'ROC',
    frequency: 'yearly',
    dueDayOfMonth: 29,
    dueMonthOffset: 8,
    gracePeriodDays: 0,
    description: 'Annual return of the company. Due 29 November after FY end.',
  },
  {
    code: 'PT-ANNUAL',
    name: 'Professional Tax — Annual Return',
    lawCode: 'PT',
    frequency: 'yearly',
    dueDayOfMonth: 30,
    dueMonthOffset: 1,
    gracePeriodDays: 0,
    description: 'State-level professional tax annual return. Cadence varies by state; demo uses 30 April.',
  },
];

const LAW_CODES = Array.from(new Set(DEMO_RULES.map((r) => r.lawCode)));

export const seedDemoRules = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const ruleService = ctx.get(ComplianceRuleService);

  const [existing] = await database.db
    .select({ id: complianceRules.id })
    .from(complianceRules)
    .limit(1);
  if (existing) return;

  const laws = await database.db
    .select({ id: complianceLaws.id, code: complianceLaws.code })
    .from(complianceLaws)
    .where(inArray(complianceLaws.code, LAW_CODES));

  const lawIdByCode = new Map(laws.map((l) => [l.code, l.id]));

  for (const rule of DEMO_RULES) {
    const lawId = lawIdByCode.get(rule.lawCode);
    if (!lawId) continue;

    await ruleService.create({
      code: rule.code,
      name: rule.name,
      lawId,
      frequency: rule.frequency,
      status: 'active',
      dueDayOfMonth: rule.dueDayOfMonth,
      dueMonthOffset: rule.dueMonthOffset,
      gracePeriodDays: rule.gracePeriodDays,
      description: rule.description,
      active: true,
    });
  }
};
