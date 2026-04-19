import { pgTable, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';
import { orgUnits } from '@packages/org-units/schema/org-units';

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),
  assigneeId: text('assignee_id').references(() => users.id),
  assigneeTeamId: text('assignee_team_id').references(() => orgUnits.id),
  dueDate: date('due_date', { mode: 'string' }),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  externalKey: text('external_key'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('tasks_assignee_id_idx').on(table.assigneeId),
  index('tasks_assignee_team_id_idx').on(table.assigneeTeamId),
  index('tasks_status_idx').on(table.status),
  index('tasks_priority_idx').on(table.priority),
  index('tasks_due_date_idx').on(table.dueDate),
  index('tasks_completed_at_idx').on(table.completedAt),
  index('tasks_related_entity_idx').on(table.relatedEntityType, table.relatedEntityId),
]);
