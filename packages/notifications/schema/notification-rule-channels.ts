import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { notificationRules } from './notification-rules';
import { notificationTemplates } from './notification-templates';

export const notificationRuleChannels = pgTable('notification_rule_channels', {
  ruleId: text('rule_id').notNull().references(() => notificationRules.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  templateId: text('template_id').notNull().references(() => notificationTemplates.id),
}, (table) => [
  primaryKey({ columns: [table.ruleId, table.channel] }),
]);
