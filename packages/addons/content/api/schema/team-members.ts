import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

export const teamMembers = pgTable('team_members', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  fullName: text('full_name').notNull(),
  role: text('role'),
  bio: text('bio'),
  photoUrl: text('photo_url'),
  linkedinUrl: text('linkedin_url'),
  email: text('email'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('team_members_display_order_idx').on(table.displayOrder),
]);
