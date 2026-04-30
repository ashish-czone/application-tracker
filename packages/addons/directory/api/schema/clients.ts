import { randomUUID } from 'node:crypto';
import { pgTable, text, jsonb, timestamp, index, char } from 'drizzle-orm/pg-core';

// Base columns for the shared identity table `clients`. Exported so that
// domains can spread them into an extended `pgTable('companies', { ... })`
// reference and add their own prefixed columns. See
// .claude/rules/module-boundaries.md → "Shared Identity Tables".
//
// NOTE: the underlying DB table is still named `companies` — the JS-side
// rename to `clients` ships ahead of the table rename, which requires
// coordinated migration work across domains and is deferred to a follow-up.
//
// Identity-shape fields (legalName, email, phone, taxId, address) are 1-per-
// client; promoting them to base means every domain sees the same canonical
// values. Domain-specific operational fields (e.g. recruit's billing/shipping
// addresses for invoicing) stay on the domain prefix.
export const baseClientColumns = {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  email: text('email'),
  phone: text('phone'),
  taxId: text('tax_id'),
  websiteDomain: text('website_domain'),
  linkedinUrl: text('linkedin_url'),
  industry: text('industry'),
  sizeBand: text('size_band'),
  countryCode: char('country_code', { length: 2 }),
  // Address — flat columns. addressCountryId is opaque TEXT (no FK constraint)
  // so apps can store either taxonomy category IDs or ISO codes without
  // coupling directory to the taxonomy addon.
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  addressCountryId: text('address_country_id'),
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

export const clients = pgTable(
  'companies',
  baseClientColumns,
  (table) => [
    index('companies_name_lower_idx').on(table.name),
    index('companies_merged_into_idx').on(table.mergedIntoId),
    // Partial unique indexes for dedup keys (email lower, website domain) are
    // added via migration SQL because drizzle-kit doesn't yet emit `WHERE`
    // clauses on uniqueIndex from the builder.
  ],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
