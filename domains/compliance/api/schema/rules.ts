import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { complianceLaws } from './laws';

export const FREQUENCIES = ['monthly', 'quarterly', 'half_yearly', 'yearly'] as const;
export type ComplianceFrequency = (typeof FREQUENCIES)[number];

export const complianceRules = pgTable('compliance_rules', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  frequency: text('frequency').notNull().$type<ComplianceFrequency>(),
  // 1–31; generator clamps to month length for short months.
  dueDayOfMonth: integer('due_day_of_month').notNull(),
  // Months to add to the period end before applying dueDayOfMonth.
  // Monthly GST (next month 20th) = 1. Quarterly GST (next month 11th) = 1.
  // Indian FY income tax (Jul 31 after FY end in March) = 4.
  dueMonthOffset: integer('due_month_offset').notNull().default(0),
  gracePeriodDays: integer('grace_period_days').notNull().default(0),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  index('compliance_rules_law_id_idx').on(table.lawId),
  index('compliance_rules_active_idx').on(table.active),
]);
