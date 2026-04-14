import type { INestApplicationContext, LoggerService } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DatabaseService, users } from '@packages/database';
import { EntityService } from '@packages/entity-engine';
import { jobOpenings } from '../schema/job-openings';
import { applications } from '../../applications/schema/applications';
import { candidates } from '../../candidates/schema/candidates';

const JO_SERVICE_TOKEN = 'ENTITY_SERVICE_job_openings';
const APP_SERVICE_TOKEN = 'ENTITY_SERVICE_applications';

const SAMPLE_JOB_OPENINGS = [
  {
    title: 'Senior Frontend Engineer',
    employmentType: 'full-time',
    experience: '5-plus-years',
    salaryMin: 15000000,
    salaryMax: 22000000,
    industry: 'technology',
    numberOfPositions: 2,
    status: 'in-progress',
    jobDescription:
      '<p>We are looking for a Senior Frontend Engineer to lead our React-based web applications.</p>',
  },
  {
    title: 'DevOps Engineer',
    employmentType: 'full-time',
    experience: '4-5-years',
    salaryMin: 12000000,
    salaryMax: 18000000,
    industry: 'technology',
    numberOfPositions: 1,
    status: 'in-progress',
    remoteJob: true,
    jobDescription:
      '<p>Join our infrastructure team to build and maintain CI/CD pipelines and cloud infrastructure.</p>',
  },
  {
    title: 'Product Designer',
    employmentType: 'full-time',
    experience: '4-5-years',
    salaryMin: 11000000,
    salaryMax: 16000000,
    industry: 'consulting',
    numberOfPositions: 1,
    status: 'in-progress',
  },
  {
    title: 'Backend Engineer Intern',
    employmentType: 'training',
    experience: 'fresher',
    salaryMin: 4000000,
    salaryMax: 6000000,
    industry: 'technology',
    numberOfPositions: 3,
    status: 'waiting-for-approval',
  },
  {
    title: 'Data Analyst (Contract)',
    employmentType: 'contract',
    experience: '1-3-years',
    salaryMin: 8000000,
    salaryMax: 12000000,
    currency: 'GBP',
    industry: 'financial-services',
    numberOfPositions: 1,
    status: 'in-progress',
  },
];

const SAMPLE_APP_TRANSITIONS: { candidateIdx: number; joIdx: number; stages: string[] }[] = [
  { candidateIdx: 0, joIdx: 0, stages: ['phone-screen', 'technical'] },
  { candidateIdx: 1, joIdx: 0, stages: ['phone-screen'] },
  { candidateIdx: 2, joIdx: 1, stages: [] },
  { candidateIdx: 0, joIdx: 2, stages: ['phone-screen', 'technical', 'on-site', 'final'] },
  { candidateIdx: 3, joIdx: 1, stages: ['phone-screen', 'technical', 'on-site'] },
];

export const seedDemoJobOpenings = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const jobOpeningService = ctx.get<EntityService>(JO_SERVICE_TOKEN);
  const applicationService = ctx.get<EntityService>(APP_SERVICE_TOKEN);
  const logger = new Logger('seedDemoJobOpenings');

  await ensureSampleJobOpenings(database, jobOpeningService);
  await ensureSampleApplications(database, applicationService, logger);
};

async function ensureSampleJobOpenings(
  database: DatabaseService,
  jobOpeningService: EntityService,
): Promise<void> {
  const [existing] = await database.db.select({ id: jobOpenings.id }).from(jobOpenings).limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  for (const data of SAMPLE_JOB_OPENINGS) {
    await jobOpeningService.create(data, admin.id);
  }
}

async function ensureSampleApplications(
  database: DatabaseService,
  applicationService: EntityService,
  logger: LoggerService,
): Promise<void> {
  const [existing] = await database.db.select({ id: applications.id }).from(applications).limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  const candidateRows = await database.db
    .select({ id: candidates.id })
    .from(candidates)
    .limit(4);

  const joRows = await database.db.select({ id: jobOpenings.id }).from(jobOpenings).limit(3);

  if (candidateRows.length === 0 || joRows.length === 0) return;

  for (const { candidateIdx, joIdx, stages } of SAMPLE_APP_TRANSITIONS) {
    const candidateId = candidateRows[candidateIdx]?.id;
    const jobOpeningId = joRows[joIdx]?.id;
    if (!candidateId || !jobOpeningId) continue;

    const app = await applicationService.create({ candidateId, jobOpeningId }, admin.id);
    const appId = (app as { id: string }).id;

    for (const targetStage of stages) {
      try {
        await applicationService.transition(appId, 'stage', targetStage, admin.id);
      } catch (err) {
        logger.warn?.(
          `Failed to transition application ${appId} to ${targetStage}: ${(err as Error).message}`,
        );
      }
    }
  }
}
