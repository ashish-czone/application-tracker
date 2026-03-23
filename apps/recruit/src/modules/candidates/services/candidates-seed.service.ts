import { Injectable, Inject, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq, users } from '@packages/database';
import { TaxonomyService, tagGroups } from '@packages/taxonomy';
import { EntityService } from '@packages/entity-engine';
import { candidates } from '../schema/candidates';

const SKILLS_GROUP_SLUG = 'recruit-skills';
const SERVICE_TOKEN = 'ENTITY_SERVICE_candidates';

const SKILL_TAGS = [
  { name: 'JavaScript', slug: 'javascript', color: '#F7DF1E' },
  { name: 'TypeScript', slug: 'typescript', color: '#3178C6' },
  { name: 'Python', slug: 'python', color: '#3776AB' },
  { name: 'Java', slug: 'java', color: '#ED8B00' },
  { name: 'React', slug: 'react', color: '#61DAFB' },
  { name: 'Node.js', slug: 'nodejs', color: '#339933' },
  { name: 'SQL', slug: 'sql', color: '#4479A1' },
  { name: 'AWS', slug: 'aws', color: '#FF9900' },
  { name: 'Docker', slug: 'docker', color: '#2496ED' },
  { name: 'Kubernetes', slug: 'kubernetes', color: '#326CE5' },
  { name: 'Go', slug: 'go', color: '#00ADD8' },
  { name: 'Rust', slug: 'rust', color: '#000000' },
  { name: 'C#', slug: 'csharp', color: '#239120' },
  { name: '.NET', slug: 'dotnet', color: '#512BD4' },
  { name: 'Ruby', slug: 'ruby', color: '#CC342D' },
  { name: 'PHP', slug: 'php', color: '#777BB4' },
  { name: 'Vue.js', slug: 'vuejs', color: '#4FC08D' },
  { name: 'Angular', slug: 'angular', color: '#DD0031' },
  { name: 'PostgreSQL', slug: 'postgresql', color: '#4169E1' },
  { name: 'MongoDB', slug: 'mongodb', color: '#47A248' },
];

const SAMPLE_CANDIDATES = [
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson@example.com',
    phone: '+14155551234',
    source: 'linkedin',
    currentCompany: 'Google',
    currentTitle: 'Senior Software Engineer',
    expectedSalary: 18000000,
    currency: 'USD',
    highestQualification: 'masters',
    nationality: 'US',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    isWillingToRelocate: true,
    linkedinUrl: 'https://linkedin.com/in/alicejohnson',
  },
  {
    firstName: 'Bob',
    lastName: 'Chen',
    email: 'bob.chen@example.com',
    phone: '+442071234567',
    source: 'referral',
    currentCompany: 'Amazon',
    currentTitle: 'DevOps Lead',
    expectedSalary: 15000000,
    currency: 'USD',
    highestQualification: 'bachelors',
    nationality: 'UK',
    city: 'London',
    country: 'UK',
    isWillingToRelocate: false,
    availableFrom: '2026-05-01',
  },
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@example.com',
    source: 'job-board',
    currentCompany: 'Infosys',
    currentTitle: 'Full Stack Developer',
    expectedSalary: 8000000,
    currency: 'USD',
    highestQualification: 'bachelors',
    nationality: 'IN',
    city: 'Bangalore',
    country: 'IN',
    isWillingToRelocate: true,
    availableFrom: '2026-04-15',
    linkedinUrl: 'https://linkedin.com/in/priyasharma',
  },
  {
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco.rossi@example.com',
    source: 'direct',
    currentTitle: 'Freelance Consultant',
    highestQualification: 'phd',
    nationality: 'IT',
    city: 'Milan',
    country: 'IT',
    isWillingToRelocate: true,
    notes: 'Strong background in machine learning and data science.',
  },
];

@Injectable()
export class CandidatesSeedService implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly taxonomyService: TaxonomyService,
    @Inject(SERVICE_TOKEN) private readonly entityService: EntityService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(CandidatesSeedService.name);
  }

  async onModuleInit() {
    // Field definitions + layout seeding is now handled by EntityEngineModule.forEntity()
    await this.ensureSkillTags();
    await this.ensureSampleCandidates();
  }

  private async ensureSkillTags() {
    const [existing] = await this.database.db
      .select()
      .from(tagGroups)
      .where(eq(tagGroups.slug, SKILLS_GROUP_SLUG))
      .limit(1);

    if (existing) return;

    const group = await this.taxonomyService.createTagGroup({
      name: 'Skills',
      slug: SKILLS_GROUP_SLUG,
      description: 'Technical skills for candidate profiles',
      allowMultiple: true,
    });

    for (const skill of SKILL_TAGS) {
      await this.taxonomyService.createTag({
        tagGroupId: group.id,
        name: skill.name,
        slug: skill.slug,
        color: skill.color,
      });
    }

    this.logger.log(`Created skills tag group with ${SKILL_TAGS.length} tags`);
  }

  private async ensureSampleCandidates() {
    const [existing] = await this.database.db
      .select({ email: candidates.email })
      .from(candidates)
      .limit(1);

    if (existing) return;

    const [admin] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (!admin) {
      this.logger.warn('No users found — skipping candidate seeding');
      return;
    }

    for (const data of SAMPLE_CANDIDATES) {
      await this.entityService.create(data, admin.id);
    }

    this.logger.log(`Created ${SAMPLE_CANDIDATES.length} sample candidates`);
  }
}
