import { pgTable, text } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull().unique(),
});
