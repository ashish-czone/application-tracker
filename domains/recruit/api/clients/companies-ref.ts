import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { baseCompanyColumns } from '@packages/directory';

// Extended `companies` reference for recruit queries. Spreads directory's
// `baseCompanyColumns` and adds recruit-prefixed columns. The physical
// table is the same `companies` row owned by directory; this reference
// just gives recruit's queries the wider row type.
//
// IMPORTANT: this file is NOT included in `drizzle.config.ts` schema array —
// drizzle-kit must not generate CREATE TABLE migrations for `companies`
// from recruit's package. The recruit_* columns are added by hand-written
// migration `0003_companies_recruit_columns.sql`.

export const recruitCompanyColumns = {
  recruitAbout: text('recruit_about'),
  recruitContactNumber: text('recruit_contact_number'),
  recruitSource: text('recruit_source'),
  recruitBillingAddress: jsonb('recruit_billing_address').$type<RecruitAddress | null>(),
  recruitShippingAddress: jsonb('recruit_shipping_address').$type<RecruitAddress | null>(),
  recruitBecameClientAt: timestamp('recruit_became_client_at', { withTimezone: true, mode: 'date' }),
  recruitArchivedAt: timestamp('recruit_archived_at', { withTimezone: true, mode: 'date' }),
} as const;

export const companies = pgTable('companies', {
  ...baseCompanyColumns,
  ...recruitCompanyColumns,
});

export type RecruitAddress = {
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type RecruitCompany = typeof companies.$inferSelect;
export type NewRecruitCompany = typeof companies.$inferInsert;
