import { pgTable, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const automationRules = pgTable('automation_rules', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  triggerType: text('trigger_type').notNull().default('event'),

  // Event trigger fields
  eventName: text('event_name'),
  delayAmount: integer('delay_amount'),
  delayUnit: text('delay_unit'),

  // Schedule trigger fields
  scheduleEntityType: text('schedule_entity_type'),
  scheduleDateField: text('schedule_date_field'),
  scheduleDateOperator: text('schedule_date_operator'),
  scheduleDateAmounts: jsonb('schedule_date_amounts'),
  scheduleDateUnit: text('schedule_date_unit'),
  scheduleDaysOfWeek: jsonb('schedule_days_of_week'),

  // Shared
  conditions: jsonb('conditions'),

  // Actions — array of { type, config, users?, link? }
  actions: jsonb('actions').notNull().default('[]'),

  // Lifecycle bindings
  onSourceUpdated: jsonb('on_source_updated'),
  onSourceDeleted: jsonb('on_source_deleted'),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
