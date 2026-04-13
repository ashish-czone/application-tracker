import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq } from '@packages/database';
import { TaxonomyService, tagGroups } from '@packages/taxonomy';

export const TASK_TAGS_GROUP_SLUG = 'task-tags';

export const DEFAULT_TASK_TAGS = [
  { name: 'Follow-up', slug: 'follow-up', color: '#3B82F6' },
  { name: 'Urgent', slug: 'urgent', color: '#EF4444' },
  { name: 'Waiting on Client', slug: 'waiting-on-client', color: '#F59E0B' },
  { name: 'Blocked', slug: 'blocked', color: '#DC2626' },
  { name: 'Research', slug: 'research', color: '#8B5CF6' },
  { name: 'Admin', slug: 'admin', color: '#6B7280' },
  { name: 'Interview', slug: 'interview', color: '#10B981' },
  { name: 'Onboarding', slug: 'onboarding', color: '#14B8A6' },
];

@Injectable()
export class TasksSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly taxonomyService: TaxonomyService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(TasksSeedService.name);
  }

  async onApplicationBootstrap() {
    await this.ensureTaskTags();
  }

  private async ensureTaskTags() {
    const [existing] = await this.database.db
      .select()
      .from(tagGroups)
      .where(eq(tagGroups.slug, TASK_TAGS_GROUP_SLUG))
      .limit(1);

    if (existing) return;

    const group = await this.taxonomyService.createTagGroup({
      name: 'Task Tags',
      slug: TASK_TAGS_GROUP_SLUG,
      description: 'Default tag group for categorizing tasks',
      allowMultiple: true,
    });

    for (const tag of DEFAULT_TASK_TAGS) {
      await this.taxonomyService.createTag({
        tagGroupId: group.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
      });
    }

    this.logger.log(`Created task tags group with ${DEFAULT_TASK_TAGS.length} default tags`);
  }
}
