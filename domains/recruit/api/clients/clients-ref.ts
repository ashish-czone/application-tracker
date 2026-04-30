import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { baseClientColumns } from '@packages/directory';

// Extended `clients` reference for recruit queries. Spreads directory's
// `baseClientColumns` and adds recruit-prefixed columns. The physical
// table is the same shared identity row owned by directory; this reference
// just gives recruit's queries the wider row type.
//
// IMPORTANT: this file is NOT included in `drizzle.config.ts` schema array —
// drizzle-kit must not generate CREATE TABLE migrations for the shared
// identity table from recruit's package. The recruit_* columns are added by
// the hand-written migration `0003_companies_recruit_columns.sql`.

export const recruitClientColumns = {
  recruitAbout: text('recruit_about'),
  recruitContactNumber: text('recruit_contact_number'),
  recruitSource: text('recruit_source'),
  recruitBillingAddress: jsonb('recruit_billing_address').$type<RecruitAddress | null>(),
  recruitShippingAddress: jsonb('recruit_shipping_address').$type<RecruitAddress | null>(),
  recruitBecameClientAt: timestamp('recruit_became_client_at', { withTimezone: true, mode: 'date' }),
  recruitArchivedAt: timestamp('recruit_archived_at', { withTimezone: true, mode: 'date' }),
} as const;

export const clients = pgTable('companies', {
  ...baseClientColumns,
  ...recruitClientColumns,
});

export type RecruitAddress = {
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type RecruitClient = typeof clients.$inferSelect;
export type NewRecruitClient = typeof clients.$inferInsert;
