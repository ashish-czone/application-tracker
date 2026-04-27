import { pgTable, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { orderableColumns } from '@packages/orderable/schema';
import { softDeleteColumns } from '@packages/soft-delete';
import { projects } from './projects';

export const milestones = pgTable('milestones', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  dueDate: date('due_date', { mode: 'string' }),
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
  index('milestones_project_id_idx').on(table.projectId),
  index('milestones_status_idx').on(table.status),
  index('milestones_due_date_idx').on(table.dueDate),
  index('milestones_project_sort_idx').on(table.projectId, table.sortOrder),
]);
