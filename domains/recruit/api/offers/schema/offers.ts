import { pgTable, text, integer, date, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const offers = pgTable('offers', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Relationships
  applicationId: text('application_id').notNull(),
  // Compensation
  salary: integer('salary'), // cents
  salaryCurrency: text('salary_currency'),
  salaryPeriod: text('salary_period'),
  signingBonus: integer('signing_bonus'), // cents
  equity: text('equity'),
  // Dates
  startDate: date('start_date', { mode: 'string' }),
  expiresAt: date('expires_at', { mode: 'string' }),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
  respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'date' }),
  // Status
  status: text('status').default('draft'),
  // Approval
  approvedBy: text('approved_by'),
  // Details
  notes: text('notes'),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('offers_application_id_idx').on(table.applicationId),
  index('offers_status_idx').on(table.status),
  index('offers_start_date_idx').on(table.startDate),
]);
