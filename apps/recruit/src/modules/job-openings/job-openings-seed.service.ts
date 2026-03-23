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
    department: 'Engineering',
    location: 'San Francisco, CA',
    employmentType: 'full-time',
    experience: '5-plus-years',
    salary: '$150,000 - $220,000',
    industry: 'technology',
    requirements: '5+ years React experience, TypeScript, state management, testing.',
    numberOfPositions: 2,
    status: 'in-progress',
  },
  {
    title: 'DevOps Engineer',
    department: 'Infrastructure',
    location: 'Remote',
    employmentType: 'full-time',
    experience: '4-5-years',
    salary: '$120,000 - $180,000',
    industry: 'technology',
    requirements: 'AWS/GCP, Docker, Kubernetes, Terraform, CI/CD pipelines.',
    numberOfPositions: 1,
    status: 'in-progress',
    remoteJob: true,
  },
  {
    title: 'Product Designer',
    department: 'Design',
    location: 'New York, NY',
    employmentType: 'full-time',
    experience: '4-5-years',
    salary: '$110,000 - $160,000',
    industry: 'design',
    requirements: 'Figma, user research, design systems, prototyping.',
    numberOfPositions: 1,
    status: 'in-progress',
  },
  {
    title: 'Backend Engineer Intern',
    department: 'Engineering',
    location: 'San Francisco, CA',
    employmentType: 'internship',
    experience: 'fresher',
    salary: '$40,000 - $60,000',
    industry: 'technology',
    requirements: 'CS student, basic Node.js/TypeScript knowledge.',
    numberOfPositions: 3,
    status: 'waiting-for-approval',
  },
  {
    title: 'Data Analyst (Contract)',
    department: 'Analytics',
    location: 'London, UK',
    employmentType: 'contract',
    experience: '1-3-years',
    salary: '£80,000 - £120,000',
    industry: 'analytics',
    requirements: 'SQL, Python, Tableau/Looker, ETL pipelines.',
    numberOfPositions: 1,
    status: 'in-progress',
  },
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

    // Get candidates and job openings to create applications
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

    const sampleApps = [
      { candidateId: candidateRows[0]?.id, jobOpeningId: joRows[0]?.id, status: 'interview', stage: 'technical' },
      { candidateId: candidateRows[1]?.id, jobOpeningId: joRows[0]?.id, status: 'screening', stage: 'phone-screen' },
      { candidateId: candidateRows[2]?.id, jobOpeningId: joRows[1]?.id, status: 'applied', stage: 'new' },
      { candidateId: candidateRows[0]?.id, jobOpeningId: joRows[2]?.id, status: 'offered', stage: 'final' },
      { candidateId: candidateRows[3]?.id, jobOpeningId: joRows[1]?.id, status: 'interview', stage: 'on-site' },
    ].filter((a) => a.candidateId && a.jobOpeningId);

    for (const data of sampleApps) {
      await this.applicationService.create(data, admin.id);
    }

    this.logger.log(`Created ${sampleApps.length} sample applications`);
  }
}
