import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { orderableColumns } from '@packages/orderable/schema';
import { softDeleteColumns } from '@packages/soft-delete';
import { milestones } from './milestones';

export const features = pgTable('features', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  milestoneId: text('milestone_id').notNull().references(() => milestones.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('backlog'),
  priority: text('priority').notNull().default('medium'),
  assigneeId: text('assignee_id'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...orderableColumns(),
  ...softDeleteColumns(),
}, (table) => [
  index('features_milestone_id_idx').on(table.milestoneId),
  index('features_assignee_id_idx').on(table.assigneeId),
  index('features_status_idx').on(table.status),
  index('features_milestone_sort_idx').on(table.milestoneId, table.sortOrder),
]);
