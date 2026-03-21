import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  eventName: text('event_name').notNull(),
  actorId: text('actor_id').references(() => users.id),
  before: jsonb('before'),
  after: jsonb('after'),
  changes: jsonb('changes'),
  correlationId: text('correlation_id'),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('audit_logs_entity_type_entity_id_idx').on(table.entityType, table.entityId),
  index('audit_logs_actor_id_idx').on(table.actorId),
  index('audit_logs_event_name_idx').on(table.eventName),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);
