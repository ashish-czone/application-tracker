import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { offers } from './offers';

export const offerApprovals = pgTable('offer_approvals', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  offerId: text('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  approverId: text('approver_id').notNull(),
  decision: text('decision').notNull().default('pending'), // pending | approved | rejected
  comment: text('comment'),
  decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('offer_approvals_offer_id_idx').on(table.offerId),
  index('offer_approvals_approver_id_idx').on(table.approverId),
  uniqueIndex('offer_approvals_offer_approver_unique_idx').on(table.offerId, table.approverId),
]);
