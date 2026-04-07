import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { CategoryService } from '@packages/taxonomy';
import { categoryGroups } from '@packages/taxonomy/schema';
import { eq } from 'drizzle-orm';

const DEPARTMENTS_GROUP_SLUG = 'departments';
const OFFICES_GROUP_SLUG = 'offices';

const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
  'Human Resources',
  'Finance',
  'Legal',
  'Customer Success',
  'Data & Analytics',
  'IT & Infrastructure',
  'Quality Assurance',
];

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

@Injectable()
export class TaxonomySeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly categoryService: CategoryService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(TaxonomySeedService.name);
  }

  async onApplicationBootstrap() {
    await this.ensureDepartments();
    await this.ensureOffices();
  }

  private async ensureDepartments() {
    const [existing] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.slug, DEPARTMENTS_GROUP_SLUG))
      .limit(1);

    if (existing) return;

    const group = await this.categoryService.createCategoryGroup({
      name: 'Departments',
      slug: DEPARTMENTS_GROUP_SLUG,
      description: 'Organization departments for job openings',
    });

    for (let i = 0; i < DEPARTMENTS.length; i++) {
      await this.categoryService.createCategory({
        groupId: group.id,
        name: DEPARTMENTS[i],
        slug: toSlug(DEPARTMENTS[i]),
        sortOrder: i,
      });
    }

    this.logger.log(`Created departments category group with ${DEPARTMENTS.length} entries`);
  }

  private async ensureOffices() {
    const [existing] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.slug, OFFICES_GROUP_SLUG))
      .limit(1);

    if (existing) return;

    // Offices group is created empty — admin populates per organization
    await this.categoryService.createCategoryGroup({
      name: 'Offices',
      slug: OFFICES_GROUP_SLUG,
      description: 'Office locations for job openings (admin-managed)',
    });

    this.logger.log('Created offices category group (empty — admin populates per organization)');
  }
}
