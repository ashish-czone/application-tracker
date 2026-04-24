import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const clients = pgTable('clients', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Client Information
  clientName: text('client_name').notNull(),
  parentClientId: text('parent_client_id'),
  contactNumber: text('contact_number'),
  website: text('website'),
  industry: text('industry'),
  about: text('about'),
  source: text('source').default('added-by-user'),
  // Billing Address
  billingStreet: text('billing_street'),
  billingCity: text('billing_city'),
  billingProvince: text('billing_province'),
  billingCode: text('billing_code'),
  billingCountry: text('billing_country'),
  // Shipping Address
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
  index('clients_client_name_idx').on(table.clientName),
  index('clients_industry_idx').on(table.industry),
  index('clients_created_by_idx').on(table.createdBy),
]);
