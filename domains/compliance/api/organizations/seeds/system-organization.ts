import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { organizations } from '../../schema/organizations';

export const seedSystemOrganization = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);

  const existing = await database.db.select({ id: organizations.id }).from(organizations).limit(1);
  if (existing.length > 0) return;

  await database.db.insert(organizations).values({
    name: 'My Organization',
  });
};
