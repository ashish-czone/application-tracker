import { Injectable, Inject, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq, users } from '@packages/database';
import { EntityService } from '@packages/entity-engine';
import { jobOpenings } from './schema/job-openings';
import { applications } from '../applications/schema/applications';
import { candidates } from '../candidates/schema/candidates';

const JO_SERVICE_TOKEN = 'ENTITY_SERVICE_job_openings';
const APP_SERVICE_TOKEN = 'ENTITY_SERVICE_applications';

const SAMPLE_JOB_OPENINGS = [
  {
    title: 'Senior Frontend Engineer',
    employmentType: 'full-time',
    experience: '5-plus-years',
    salary: '$150,000 - $220,000',
    industry: 'technology',
    numberOfPositions: 2,
    status: 'in-progress',
    jobDescription: '<p>We are looking for a Senior Frontend Engineer to lead our React-based web applications.</p>',
  },
  {
    title: 'DevOps Engineer',
    employmentType: 'full-time',
    experience: '4-5-years',
    salary: '$120,000 - $180,000',
    industry: 'technology',
    numberOfPositions: 1,
    status: 'in-progress',
    remoteJob: true,
    jobDescription: '<p>Join our infrastructure team to build and maintain CI/CD pipelines and cloud infrastructure.</p>',
  },
  {
    title: 'Product Designer',
    employmentType: 'full-time',
    experience: '4-5-years',
    salary: '$110,000 - $160,000',
    industry: 'consulting',
    numberOfPositions: 1,
    status: 'in-progress',
  },
  {
    title: 'Backend Engineer Intern',
    employmentType: 'training',
    experience: 'fresher',
    salary: '$40,000 - $60,000',
    industry: 'technology',
    numberOfPositions: 3,
    status: 'waiting-for-approval',
  },
  {
    title: 'Data Analyst (Contract)',
    employmentType: 'contract',
    experience: '1-3-years',
    salary: '£80,000 - £120,000',
    industry: 'financial-services',
    numberOfPositions: 1,
    status: 'in-progress',
  },
];

/** Transition paths for sample applications (each array = sequence of stages to transition through) */
const SAMPLE_APP_TRANSITIONS: { candidateIdx: number; joIdx: number; stages: string[] }[] = [
  { candidateIdx: 0, joIdx: 0, stages: ['phone-screen', 'technical'] },
  { candidateIdx: 1, joIdx: 0, stages: ['phone-screen'] },
  { candidateIdx: 2, joIdx: 1, stages: [] },  // stays at 'new'
  { candidateIdx: 0, joIdx: 2, stages: ['phone-screen', 'technical', 'on-site', 'final'] },
  { candidateIdx: 3, joIdx: 1, stages: ['phone-screen', 'technical', 'on-site'] },
];

@Injectable()
export class JobOpeningsSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    @Inject(JO_SERVICE_TOKEN) private readonly jobOpeningService: EntityService,
    @Inject(APP_SERVICE_TOKEN) private readonly applicationService: EntityService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(JobOpeningsSeedService.name);
  }

  async onApplicationBootstrap() {
    await this.ensureSampleJobOpenings();
    await this.ensureSampleApplications();
  }

  private async ensureSampleJobOpenings() {
    const [existing] = await this.database.db
      .select({ id: jobOpenings.id })
      .from(jobOpenings)
      .limit(1);

    if (existing) return;

    const [admin] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (!admin) {
      this.logger.warn('No users found — skipping job openings seeding');
      return;
    }

    for (const data of SAMPLE_JOB_OPENINGS) {
      await this.jobOpeningService.create(data, admin.id);
    }

    this.logger.log(`Created ${SAMPLE_JOB_OPENINGS.length} sample job openings`);
  }

  private async ensureSampleApplications() {
    const [existing] = await this.database.db
      .select({ id: applications.id })
      .from(applications)
      .limit(1);

    if (existing) return;

    const [admin] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (!admin) return;

    const candidateRows = await this.database.db
      .select({ id: candidates.id })
      .from(candidates)
      .limit(4);

    const joRows = await this.database.db
      .select({ id: jobOpenings.id })
      .from(jobOpenings)
      .limit(3);

    if (candidateRows.length === 0 || joRows.length === 0) {
      this.logger.warn('No candidates or job openings — skipping application seeding');
      return;
    }

    let created = 0;
    for (const { candidateIdx, joIdx, stages } of SAMPLE_APP_TRANSITIONS) {
      const candidateId = candidateRows[candidateIdx]?.id;
      const jobOpeningId = joRows[joIdx]?.id;
      if (!candidateId || !jobOpeningId) continue;

      // Create application at initial state ('new')
      const app = await this.applicationService.create(
        { candidateId, jobOpeningId },
        admin.id,
      );
      const appId = (app as any).id as string;

      // Transition through each stage to build proper history
      for (const targetStage of stages) {
        try {
          await this.applicationService.transition(appId, 'stage', targetStage, admin.id);
        } catch (err) {
          this.logger.warn(`Failed to transition application ${appId} to ${targetStage}: ${(err as Error).message}`);
        }
      }

      created++;
    }

    this.logger.log(`Created ${created} sample applications with transition history`);
  }
}
