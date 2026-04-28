import { randomUUID } from 'node:crypto';
import { pgTable, text, jsonb, timestamp, index, uniqueIndex, char } from 'drizzle-orm/pg-core';

export const companies = pgTable(
  'companies',
  {
    id: text('id').primaryKey().$defaultFn(() => randomUUID()),
    name: text('name').notNull(),
    websiteDomain: text('website_domain'),
    linkedinUrl: text('linkedin_url'),
    industry: text('industry'),
    sizeBand: text('size_band'),
    countryCode: char('country_code', { length: 2 }),
    defaultContactId: text('default_contact_id'),
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
    index('companies_name_lower_idx').on(table.name),
    index('companies_merged_into_idx').on(table.mergedIntoId),
    // Partial unique indexes for dedup keys are added via migration SQL because
    // drizzle-kit doesn't yet emit `WHERE` clauses on uniqueIndex from the builder.
  ],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
