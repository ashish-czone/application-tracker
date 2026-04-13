import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { evaluationTemplates } from '@packages/evaluations/schema';

const TEMPLATES = [
  {
    slug: 'application-review',
    name: 'Application Review',
    entityType: 'applications',
    criteria: [
      { name: 'Technical Skills', description: 'Relevant technical expertise for the role' },
      { name: 'Communication', description: 'Clarity, articulation, and interpersonal skills' },
      { name: 'Culture Fit', description: 'Alignment with team values and work style' },
      { name: 'Experience', description: 'Relevance and depth of prior experience' },
    ],
  },
];

@Injectable()
export class ApplicationsEvaluationsSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ApplicationsEvaluationsSeedService.name);
  }

  async onApplicationBootstrap() {
    const [existing] = await this.database.db
      .select({ id: evaluationTemplates.id })
      .from(evaluationTemplates)
      .where(withTenant(evaluationTemplates))
      .limit(1);

    if (existing) return;

    this.logger.log('Seeding evaluation templates for applications...');

    for (const template of TEMPLATES) {
      await this.database.db
        .insert(evaluationTemplates)
        .values(withTenantInsert(evaluationTemplates, template));
    }

    this.logger.log('Evaluation templates seeded successfully');
  }
}
