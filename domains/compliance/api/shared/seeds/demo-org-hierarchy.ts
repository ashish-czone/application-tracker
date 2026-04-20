import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import {
  OrgUnitService,
  OrgUnitLevelService,
  orgUnits,
} from '@packages/org-units';

const COMPANY_NAME = 'Demo Compliance Practice';
const COMPANY_DESCRIPTION =
  'Chartered Accountants and Company Secretaries. Full-service compliance advisory firm providing regulatory, tax, and corporate governance services.';

interface UnitSpec {
  name: string;
  description: string;
  level: 'Entity' | 'Division';
  children?: UnitSpec[];
}

const HIERARCHY: UnitSpec[] = [
  {
    name: 'Tax & Regulatory',
    level: 'Entity',
    description:
      'Handles direct and indirect tax compliance — GST, Income Tax, TDS, Professional Tax. Responsible for return filing, assessments, and advisory.',
    children: [
      {
        name: 'GST Division',
        level: 'Division',
        description:
          'Monthly and quarterly GST return filing — GSTR-1, GSTR-3B, GSTR-9. Input tax credit reconciliation and audit.',
      },
      {
        name: 'Income Tax Division',
        level: 'Division',
        description:
          'Income tax return filing, advance tax computation, TDS compliance, assessment proceedings, and appeals.',
      },
    ],
  },
  {
    name: 'Corporate & Secretarial',
    level: 'Entity',
    description:
      'Company law compliance — ROC filings, board resolutions, annual returns, FEMA compliance, and corporate governance advisory.',
    children: [
      {
        name: 'ROC Filings',
        level: 'Division',
        description:
          'Registrar of Companies — annual returns, charge registration, director changes, share transfers, and statutory registers.',
      },
      {
        name: 'Audit & Assurance',
        level: 'Division',
        description:
          'Statutory audit, internal audit, tax audit, CARO compliance, and management letter preparation.',
      },
    ],
  },
];

export const seedDemoOrgHierarchy = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const orgUnitService = ctx.get(OrgUnitService);
  const orgUnitLevelService = ctx.get(OrgUnitLevelService);

  // Skip unless demo-law-handlers has already seeded the root Company.
  const [company] = await database.db
    .select({ id: orgUnits.id, description: orgUnits.description })
    .from(orgUnits)
    .where(eq(orgUnits.name, COMPANY_NAME))
    .limit(1);
  if (!company) return;

  // Backfill description on the root company if missing.
  if (!company.description) {
    await database.db
      .update(orgUnits)
      .set({ description: COMPANY_DESCRIPTION })
      .where(eq(orgUnits.id, company.id));
  }

  const levels = await orgUnitLevelService.findAll();
  const levelByName = new Map(levels.map((l) => [l.name, l.id] as const));

  let entitySort = 0;
  for (const entity of HIERARCHY) {
    const entityLevelId = levelByName.get(entity.level);
    if (!entityLevelId) continue;

    const [existingEntity] = await database.db
      .select({ id: orgUnits.id })
      .from(orgUnits)
      .where(eq(orgUnits.name, entity.name))
      .limit(1);
    if (existingEntity) continue;

    const entityRow = await orgUnitService.create({
      name: entity.name,
      description: entity.description,
      parentId: company.id,
      levelId: entityLevelId,
      sortOrder: entitySort++,
    });

    let childSort = 0;
    for (const child of entity.children ?? []) {
      const childLevelId = levelByName.get(child.level);
      if (!childLevelId) continue;
      await orgUnitService.create({
        name: child.name,
        description: child.description,
        parentId: entityRow.id,
        levelId: childLevelId,
        sortOrder: childSort++,
      });
    }
  }
};
