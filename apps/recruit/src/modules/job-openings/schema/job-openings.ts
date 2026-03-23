import { pgTable, text, integer, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';

export const jobOpenings = pgTable('job_openings', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Core
  title: text('title').notNull(),
  department: text('department'),
  location: text('location'),
  employmentType: text('employment_type').default('full-time'),
  experience: text('experience'),
  // Compensation
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  currency: text('currency').default('USD'),
  // Details
  description: text('description'),
  requirements: text('requirements'),
  numberOfPositions: integer('number_of_positions').default(1),
  // Status
  status: text('status').default('draft'),
  // Dates
  publishedAt: date('published_at', { mode: 'string' }),
  closingDate: date('closing_date', { mode: 'string' }),
  // Audit
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('job_openings_status_idx').on(table.status),
  index('job_openings_department_idx').on(table.department),
  index('job_openings_created_by_idx').on(table.createdBy),
]);
