import { pgTable, text, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { orgUnits } from '@packages/org-units/schema/org-units';
import { softDeleteColumns } from '@packages/soft-delete';
import { complianceLaws } from './laws';
import { complianceRules } from './rules';

// `clientId` references the shared identity `clients` row (DB name
// `companies`). FK added at SQL migration level — see note in
// client-registrations.ts.

// Standalone compliance-filings table. Filings are first-class domain entities
// (a compliance obligation that must be filed for a client within a period),
// not an extension of the generic tasks addon. Carries:
//   - lifecycle fields (title/description/priority/assignee/dueDate/completedAt)
//     used by list/detail UIs;
//   - `status` column driven directly by the compliance-filings workflow
//     (pending → in_progress → review → completed, with rejected + cancelled);
//   - existing compliance dimensions (rule, client, law, period);
//   - externalKey for idempotent regeneration across action retries.
//
// Idempotency surface:
//   - `external_key` (unique where not null) is the format-stable key the
//     generate action uses to dedupe across retries.
//   - (rule_id, client_id, period_start) is the natural-key protection that
//     survives key-format changes.
export const complianceFilings = pgTable('compliance_filings', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),

  title: text('title').notNull(),
  description: text('description'),

  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),

  assigneeId: text('assignee_id'),
  assigneeTeamId: text('assignee_team_id').notNull().references(() => orgUnits.id),

  dueDate: date('due_date', { mode: 'string' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),

  ruleId: text('rule_id').notNull().references(() => complianceRules.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),

  externalKey: text('external_key'),

  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('compliance_filings_assignee_id_idx').on(table.assigneeId),
  index('compliance_filings_assignee_team_id_idx').on(table.assigneeTeamId),
  index('compliance_filings_status_idx').on(table.status),
  index('compliance_filings_due_date_idx').on(table.dueDate),
  index('compliance_filings_completed_at_idx').on(table.completedAt),
  index('compliance_filings_rule_id_idx').on(table.ruleId),
  index('compliance_filings_law_id_idx').on(table.lawId),
  index('compliance_filings_client_period_idx').on(table.clientId, table.periodStart),
  index('compliance_filings_period_start_idx').on(table.periodStart),
  uniqueIndex('compliance_filings_rule_client_period_key').on(
    table.ruleId,
    table.clientId,
    table.periodStart,
  ),
  uniqueIndex('compliance_filings_external_key_unique')
    .on(table.externalKey)
    .where(sql`external_key IS NOT NULL`),
]);
