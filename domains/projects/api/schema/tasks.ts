import { pgTable, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { orderableColumns } from '@packages/orderable/schema';
import { softDeleteColumns } from '@packages/soft-delete';
import { features } from './features';

// SQL table is `project_tasks` to avoid colliding with @packages/tasks
// (a platform addon that owns the unprefixed `tasks` table). The TS
// symbol stays `tasks` so service/controller/UI code reads naturally.
export const tasks = pgTable('project_tasks', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'),
  assigneeId: text('assignee_id'),
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
  index('project_tasks_feature_id_idx').on(table.featureId),
  index('project_tasks_assignee_id_idx').on(table.assigneeId),
  index('project_tasks_status_idx').on(table.status),
  index('project_tasks_due_date_idx').on(table.dueDate),
  index('project_tasks_feature_sort_idx').on(table.featureId, table.sortOrder),
]);
