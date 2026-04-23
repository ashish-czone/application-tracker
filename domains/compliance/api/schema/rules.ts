import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import type { ComplianceFrequency } from '@domains/compliance-contract';
import { complianceLaws } from './laws';

export const complianceRules = pgTable('compliance_rules', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  code: text('code').notNull(),
  name: text('name').notNull(),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  frequency: text('frequency').notNull().$type<ComplianceFrequency>(),
  status: text('status').notNull().default('draft'),
  // 1–31; generator clamps to month length for short months.
  dueDayOfMonth: integer('due_day_of_month').notNull(),
  // Months to add to the period end before applying dueDayOfMonth.
  // Monthly GST (next month 20th) = 1. Quarterly GST (next month 11th) = 1.
  // Indian FY income tax (Jul 31 after FY end in March) = 4.
  dueMonthOffset: integer('due_month_offset').notNull().default(0),
  gracePeriodDays: integer('grace_period_days').notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('compliance_rules_code_key').on(table.code),
  index('compliance_rules_law_id_idx').on(table.lawId),
  index('compliance_rules_status_idx').on(table.status),
]);
