import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { TaxonomyService, tagGroups } from '@packages/taxonomy';

const TASK_TAGS_GROUP_SLUG = 'task-tags';

const DEFAULT_TASK_TAGS = [
  { name: 'Follow-up', slug: 'follow-up', color: '#3B82F6' },
  { name: 'Urgent', slug: 'urgent', color: '#EF4444' },
  { name: 'Waiting on Client', slug: 'waiting-on-client', color: '#F59E0B' },
  { name: 'Blocked', slug: 'blocked', color: '#DC2626' },
  { name: 'Research', slug: 'research', color: '#8B5CF6' },
  { name: 'Admin', slug: 'admin', color: '#6B7280' },
  { name: 'Interview', slug: 'interview', color: '#10B981' },
  { name: 'Onboarding', slug: 'onboarding', color: '#14B8A6' },
];

export const seedDemoTaskTags = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const taxonomyService = ctx.get(TaxonomyService);

  const [existing] = await database.db
    .select()
    .from(tagGroups)
    .where(eq(tagGroups.slug, TASK_TAGS_GROUP_SLUG))
    .limit(1);

  if (existing) return;

  const group = await taxonomyService.createTagGroup({
    name: 'Task Tags',
    slug: TASK_TAGS_GROUP_SLUG,
    description: 'Default tag group for categorizing tasks',
    allowMultiple: true,
  });

  for (const tag of DEFAULT_TASK_TAGS) {
    await taxonomyService.createTag({
      tagGroupId: group.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
    });
  }
};
