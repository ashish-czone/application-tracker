import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, inArray, users } from '@packages/database';
import {
  OrgUnitService,
  OrgUnitLevelService,
  OrgPositionService,
  orgUnits,
} from '@packages/org-units';
import { complianceLaws } from '../../schema/laws';
import { complianceLawHandlers } from '../../schema/law-handlers';
import { LawHandlersService } from '../law-handlers.service';
import { DEMO_USER_EMAILS } from '../../users/seeds/demo-users';

const COMPANY_NAME = 'Demo Compliance Practice';
const TEAM_NAME = 'Compliance Team';

// Laws that get a global handler pointing at the Compliance Team.
// These are the system laws seeded by @domains/compliance-api/system-laws.
const HANDLED_LAW_CODES = ['GST', 'ITR', 'TDS', 'ROC', 'PT'];

export const seedDemoLawHandlers = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const orgUnitService = ctx.get(OrgUnitService);
  const orgUnitLevelService = ctx.get(OrgUnitLevelService);
  const orgPositionService = ctx.get(OrgPositionService);
  const lawHandlersService = ctx.get(LawHandlersService);

  const [existing] = await database.db
    .select({ id: complianceLawHandlers.id })
    .from(complianceLawHandlers)
    .limit(1);
  if (existing) return;

  const teamId = await ensureTeam(database, orgUnitService, orgUnitLevelService, orgPositionService);
  if (!teamId) return;

  const laws = await database.db
    .select({ id: complianceLaws.id, code: complianceLaws.code })
    .from(complianceLaws)
    .where(inArray(complianceLaws.code, HANDLED_LAW_CODES));

  for (const law of laws) {
    await lawHandlersService.createHandler({
      lawId: law.id,
      orgEntityId: teamId,
      clientId: null,
      isPrimary: true,
    });
  }
};

async function ensureTeam(
  database: DatabaseService,
  orgUnitService: OrgUnitService,
  orgUnitLevelService: OrgUnitLevelService,
  orgPositionService: OrgPositionService,
): Promise<string | null> {
  const existingTeam = await database.db
    .select({ id: orgUnits.id })
    .from(orgUnits)
    .where(eq(orgUnits.name, TEAM_NAME))
    .limit(1);
  if (existingTeam[0]) return existingTeam[0].id;

  const levels = await orgUnitLevelService.findAll();
  const companyLevel = levels.find((l) => l.name === 'Company');
  const teamLevel = levels.find((l) => l.name === 'Team');
  if (!companyLevel || !teamLevel) return null;

  const existingCompany = await database.db
    .select({ id: orgUnits.id })
    .from(orgUnits)
    .where(eq(orgUnits.name, COMPANY_NAME))
    .limit(1);

  const companyId = existingCompany[0]
    ? existingCompany[0].id
    : (await orgUnitService.create({ name: COMPANY_NAME, levelId: companyLevel.id, sortOrder: 0 })).id;

  const team = await orgUnitService.create({
    name: TEAM_NAME,
    parentId: companyId,
    levelId: teamLevel.id,
    sortOrder: 0,
  });

  const positions = await orgPositionService.findAll();
  const leadPositionId = positions.find((p) => p.name === 'Lead')?.id;
  const memberPositionId = positions.find((p) => p.name === 'Member')?.id;

  const memberRows = await database.db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, DEMO_USER_EMAILS));

  for (let i = 0; i < memberRows.length; i++) {
    const positionId = i === 0 ? leadPositionId : memberPositionId;
    await orgUnitService.addMember(team.id, memberRows[i].id, positionId ?? undefined);
  }

  // Also add the system admin so task ownership lookups still work for admin login.
  const adminRows = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'admin@admin.com'))
    .limit(1);
  if (adminRows[0] && leadPositionId) {
    await orgUnitService.addMember(team.id, adminRows[0].id, leadPositionId);
  }

  return team.id;
}
