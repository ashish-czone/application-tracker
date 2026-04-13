import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { automationRules } from './automation-rules';

export const automationExecutions = pgTable('automation_executions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  ruleId: text('rule_id').notNull().references(() => automationRules.id, { onDelete: 'cascade' }),
  actionIndex: integer('action_index').notNull(),
  actionType: text('action_type').notNull(),

  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),

  status: text('status').notNull(), // 'success' | 'error'
  errorMessage: text('error_message'),

  executedAt: timestamp('executed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('automation_executions_rule_idx').on(table.ruleId),
  index('automation_executions_entity_idx').on(table.entityType, table.entityId),
]);
