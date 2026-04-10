import { pgTable, text, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';
import { orgUnits } from './org-units';
import { orgPositions } from './org-positions';

export const orgUnitMembers = pgTable('org_unit_members', {
  orgUnitId: text('org_unit_id').notNull().references(() => orgUnits.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  positionId: text('position_id').references(() => orgPositions.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.orgUnitId, table.userId] }),
]);
