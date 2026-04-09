import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';
import { offers } from './offers';

export const offerApprovals = pgTable('offer_approvals', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  offerId: text('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
  approverId: text('approver_id').notNull().references(() => users.id),
  decision: text('decision').notNull().default('pending'), // pending | approved | rejected
  comment: text('comment'),
  decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('offer_approvals_offer_id_idx').on(table.offerId),
  index('offer_approvals_approver_id_idx').on(table.approverId),
]);
