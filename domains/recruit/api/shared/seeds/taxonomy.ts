import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { CategoryService } from '@packages/taxonomy';
import { categoryGroups } from '@packages/taxonomy/schema';

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

export const seedTaxonomy = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const categoryService = ctx.get(CategoryService);

  await ensureDepartments(database, categoryService);
  await ensureOffices(database, categoryService);
};

async function ensureDepartments(
  database: DatabaseService,
  categoryService: CategoryService,
): Promise<void> {
  const [existing] = await database.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.slug, DEPARTMENTS_GROUP_SLUG))
    .limit(1);

  if (existing) return;

  const group = await categoryService.createCategoryGroup({
    name: 'Departments',
    slug: DEPARTMENTS_GROUP_SLUG,
    description: 'Organization departments for job openings',
  });

  for (let i = 0; i < DEPARTMENTS.length; i++) {
    await categoryService.createCategory({
      groupId: group.id,
      name: DEPARTMENTS[i],
      slug: toSlug(DEPARTMENTS[i]),
      sortOrder: i,
    });
  }
}

async function ensureOffices(
  database: DatabaseService,
  categoryService: CategoryService,
): Promise<void> {
  const [existing] = await database.db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.slug, OFFICES_GROUP_SLUG))
    .limit(1);

  if (existing) return;

  // Offices group is created empty — admin populates per organization.
  await categoryService.createCategoryGroup({
    name: 'Offices',
    slug: OFFICES_GROUP_SLUG,
    description: 'Office locations for job openings (admin-managed)',
  });
}
