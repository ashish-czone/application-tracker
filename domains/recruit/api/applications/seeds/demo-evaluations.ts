import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { EvaluationTemplatesService } from '@packages/evaluations';

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

export const seedDemoEvaluations = async (ctx: INestApplicationContext): Promise<void> => {
  const templateService = ctx.get(EvaluationTemplatesService);
  const logger: LoggerService = new Logger('seedDemoEvaluations');

  for (const template of TEMPLATES) {
    const existing = await templateService.findBySlug(template.slug);
    if (existing) continue;
    await templateService.create(template);
  }

  logger.log?.(`Seeded ${TEMPLATES.length} evaluation template(s)`);
};
