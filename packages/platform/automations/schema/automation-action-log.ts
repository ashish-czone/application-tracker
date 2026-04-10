import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { automationRules } from './automation-rules';

export const automationActionLog = pgTable('automation_action_log', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  ruleId: text('rule_id').notNull().references(() => automationRules.id, { onDelete: 'cascade' }),
  actionIndex: integer('action_index').notNull(),
  linkName: text('link_name'),

  sourceEntityType: text('source_entity_type').notNull(),
  sourceEntityId: text('source_entity_id').notNull(),
  targetEntityType: text('target_entity_type').notNull(),
  targetEntityId: text('target_entity_id').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('automation_action_log_source_idx').on(table.ruleId, table.sourceEntityType, table.sourceEntityId),
  index('automation_action_log_link_idx').on(table.ruleId, table.linkName, table.sourceEntityType, table.sourceEntityId),
]);
