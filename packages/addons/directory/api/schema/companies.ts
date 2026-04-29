import { randomUUID } from 'node:crypto';
import { pgTable, text, jsonb, timestamp, index, char } from 'drizzle-orm/pg-core';

// Base columns for the shared identity table `companies`. Exported so that
// domains can spread them into an extended `pgTable('companies', { ... })`
// reference and add their own prefixed columns. See
// .claude/rules/module-boundaries.md → "Shared Identity Tables".
export const baseCompanyColumns = {
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
} as const;

export const companies = pgTable(
  'companies',
  baseCompanyColumns,
  (table) => [
    index('companies_name_lower_idx').on(table.name),
    index('companies_merged_into_idx').on(table.mergedIntoId),
    // Partial unique indexes for dedup keys are added via migration SQL because
    // drizzle-kit doesn't yet emit `WHERE` clauses on uniqueIndex from the builder.
  ],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
