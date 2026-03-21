import { pgTable, text, integer, date, boolean, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';

export const candidates = pgTable('candidates', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Core
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  source: text('source').default('direct'),
  // Professional
  currentCompany: text('current_company'),
  currentTitle: text('current_title'),
  expectedSalary: integer('expected_salary'),
  currency: text('currency').default('USD'),
  highestQualification: text('highest_qualification'),
  // Personal
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  gender: text('gender'),
  nationality: text('nationality'),
  // Location
  address: text('address'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  zipCode: text('zip_code'),
  // Availability
  isWillingToRelocate: boolean('is_willing_to_relocate').default(false),
  availableFrom: date('available_from', { mode: 'string' }),
  // Social
  linkedinUrl: text('linkedin_url'),
  // Other
  notes: text('notes'),
  resumeFile: jsonb('resume_file'),
  // Audit
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  uniqueIndex('candidates_email_unique').on(table.email).where(sql`deleted_at IS NULL`),
  index('candidates_source_idx').on(table.source),
  index('candidates_country_idx').on(table.country),
  index('candidates_created_by_idx').on(table.createdBy),
]);
