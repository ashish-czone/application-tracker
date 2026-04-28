import { randomUUID } from 'node:crypto';
import { pgTable, text, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { companies } from './companies';

export const people = pgTable(
  'people',
  {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),
    fullName: text('full_name').notNull(),
    primaryEmail: text('primary_email'),
    primaryPhone: text('primary_phone'),
    linkedinUrl: text('linkedin_url'),
    jobTitle: text('job_title'),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    doNotContact: boolean('do_not_contact').notNull().default(false),
    externalIds: jsonb('external_ids').notNull().default({}),
    mergedIntoId: text('merged_into_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
    createdBy: text('created_by').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    deletedBy: text('deleted_by'),
  },
  (table) => [
    index('people_company_id_idx').on(table.companyId),
    index('people_full_name_lower_idx').on(table.fullName),
    index('people_merged_into_idx').on(table.mergedIntoId),
    // Partial unique indexes for primary_email + linkedin_url come from migration SQL.
  ],
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
