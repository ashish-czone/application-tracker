import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const clients = pgTable('recruit_clients', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Identity FK to directory.companies. Nullable until R-3 backfill is complete
  // and old identity columns are dropped.
  companyId: text('company_id'),
  // Legacy identity columns — read by services until R-2 rewires to directory,
  // dropped in R-3.
  clientName: text('client_name').notNull(),
  contactNumber: text('contact_number'),
  website: text('website'),
  industry: text('industry'),
  about: text('about'),
  source: text('source').default('added-by-user'),
  // Billing Address (recruit-specific commercial — stays here)
  billingStreet: text('billing_street'),
  billingCity: text('billing_city'),
  billingProvince: text('billing_province'),
  billingCode: text('billing_code'),
  billingCountry: text('billing_country'),
  // Shipping Address (recruit-specific commercial — stays here)
  shippingStreet: text('shipping_street'),
  shippingCity: text('shipping_city'),
  shippingProvince: text('shipping_province'),
  shippingCode: text('shipping_code'),
  shippingCountry: text('shipping_country'),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('recruit_clients_client_name_idx').on(table.clientName),
  index('recruit_clients_industry_idx').on(table.industry),
  index('recruit_clients_created_by_idx').on(table.createdBy),
  index('recruit_clients_company_id_idx').on(table.companyId),
]);
