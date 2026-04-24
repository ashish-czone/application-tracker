import { pgTable, text, integer, boolean, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const jobOpenings = pgTable('job_openings', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Job Opening Information
  title: text('title').notNull(),
  clientId: text('client_id'),
  contactId: text('contact_id'),
  dateOpened: date('date_opened', { mode: 'string' }),
  targetDate: date('target_date', { mode: 'string' }),
  employmentType: text('employment_type').default('full-time'),
  status: text('status').default('in-progress'),
  hiringManager: text('hiring_manager'),
  experience: text('experience'),
  industry: text('industry'),
  jobFunction: text('job_function'),
  confidential: boolean('confidential').default(false),
  requirements: text('requirements'),
  // Address
  department: text('department'),
  location: text('location'),
  country: text('country'),
  postalCode: text('postal_code'),
  remoteJob: boolean('remote_job').default(false),
  // Forecast
  numberOfPositions: integer('number_of_positions').default(1),
  revenuePerPosition: integer('revenue_per_position'),
  expectedRevenue: integer('expected_revenue'),
  actualRevenue: integer('actual_revenue'),
  missedRevenue: integer('missed_revenue'),
  // Legacy columns (kept for backwards compat)
  description: text('description'),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  currency: text('currency').default('USD'),
  publishedAt: date('published_at', { mode: 'string' }),
  closingDate: date('closing_date', { mode: 'string' }),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('job_openings_status_idx').on(table.status),
  index('job_openings_department_idx').on(table.department),
  index('job_openings_client_id_idx').on(table.clientId),
  index('job_openings_created_by_idx').on(table.createdBy),
]);
