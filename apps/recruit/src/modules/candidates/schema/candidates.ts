import { pgTable, text, integer, numeric, date, boolean, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';

export const candidates = pgTable('candidates', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Basic Info
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  mobile: text('mobile'),
  website: text('website'),
  secondaryEmail: text('secondary_email'),
  fax: text('fax'),
  // Address
  street: text('street'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  // Professional Details
  experienceInYears: numeric('experience_in_years'),
  highestQualification: text('highest_qualification'),
  currentTitle: text('current_title'),
  currentCompany: text('current_company'),
  noticePeriod: text('notice_period'),
  expectedSalary: integer('expected_salary'),
  salaryExpectationMin: integer('salary_expectation_min'),
  salaryExpectationMax: integer('salary_expectation_max'),
  currentSalary: integer('current_salary'),
  currency: text('currency').default('USD'),
  skillSet: text('skill_set'),
  additionalInfo: text('additional_info'),
  skypeId: text('skype_id'),
  // Social Links
  linkedinUrl: text('linkedin_url'),
  facebookUrl: text('facebook_url'),
  twitterHandle: text('twitter_handle'),
  // Other Info
  candidateStatus: text('candidate_status').default('new'),
  source: text('source').default('added-by-user'),
  emailOptOut: boolean('email_opt_out').default(false),
  // Legacy columns (kept for backwards compat)
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  gender: text('gender'),
  nationality: text('nationality'),
  isWillingToRelocate: boolean('is_willing_to_relocate').default(false),
  availableFrom: date('available_from', { mode: 'string' }),
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
  index('candidates_candidate_status_idx').on(table.candidateStatus),
  index('candidates_country_idx').on(table.country),
  index('candidates_created_by_idx').on(table.createdBy),
]);
