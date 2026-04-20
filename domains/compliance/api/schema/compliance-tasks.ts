import { pgTable, text, date, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { tasks } from '@packages/tasks/schema/tasks';
import { complianceLaws } from './laws';
import { clients } from './clients';
import { complianceRules } from './rules';

// 1-1 extension of a base tasks row with compliance-specific dimensions.
// The tasks row sets `kind = 'compliance'`; this row carries the
// (rule, client, period) tuple that makes the task meaningful in a
// compliance context. CASCADE on task_id: when the base task is hard-
// deleted the extension goes with it.
//
// Idempotency surface:
//   - `tasks.external_key` (platform primitive, unique per (kind, key))
//     is the format-stable key the action uses to dedupe across retries.
//   - (rule_id, client_id, period_start) is the natural-key protection
//     that survives key-format changes.
export const complianceTasks = pgTable('compliance_tasks', {
  taskId: text('task_id')
    .primaryKey()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id').notNull().references(() => complianceRules.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('compliance_tasks_rule_client_period_key').on(
    table.ruleId,
    table.clientId,
    table.periodStart,
  ),
  index('compliance_tasks_client_period_idx').on(table.clientId, table.periodStart),
  index('compliance_tasks_rule_id_idx').on(table.ruleId),
  index('compliance_tasks_law_id_idx').on(table.lawId),
  index('compliance_tasks_period_start_idx').on(table.periodStart),
]);
