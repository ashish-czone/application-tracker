import { randomUUID } from 'crypto';
import type { DrizzleDB } from '@packages/database';
import { users } from '@packages/database';
import { orgUnits, orgUnitLevels } from '@packages/org-units';
import {
  clients,
  clientContacts,
  complianceLaws,
  complianceRules,
  complianceClientRegistrations,
  complianceLawHandlers,
  complianceFilings,
} from '../../schema';

/**
 * Direct-insert fixtures for integration tests. Bypasses the entity-engine
 * service layer (and its beforeCreate hooks) because these are *prereqs* for
 * the entity under test — each test exercises the target HTTP endpoint itself.
 *
 * Keep this helper lean: only the fields needed to satisfy NOT-NULL + FK
 * constraints. Tests pass `overrides` when they need specific values.
 */

let seq = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

export async function createUser(
  db: DrizzleDB,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(users).values({
    id,
    email: overrides.email ?? `${unique('user')}@example.com`,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    userType: overrides.userType ?? 'admin',
    ...overrides,
  });
  return { id };
}

export async function createOrgUnitLevel(
  db: DrizzleDB,
  overrides: Partial<typeof orgUnitLevels.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(orgUnitLevels).values({
    id,
    name: overrides.name ?? unique('Level'),
    sortOrder: overrides.sortOrder ?? 0,
    ...overrides,
  });
  return { id };
}

export async function createOrgUnit(
  db: DrizzleDB,
  levelId: string,
  overrides: Partial<typeof orgUnits.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(orgUnits).values({
    id,
    name: overrides.name ?? unique('Team'),
    levelId,
    ...overrides,
  });
  return { id };
}

export async function createLaw(
  db: DrizzleDB,
  overrides: Partial<typeof complianceLaws.$inferInsert> = {},
): Promise<{ id: string; code: string }> {
  const id = overrides.id ?? randomUUID();
  const code = overrides.code ?? unique('LAW');
  await db.insert(complianceLaws).values({
    id,
    name: overrides.name ?? `Law ${code}`,
    code,
    jurisdiction: overrides.jurisdiction ?? 'central',
    ...overrides,
  });
  return { id, code };
}

export async function createClient(
  db: DrizzleDB,
  overrides: Partial<typeof clients.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(clients).values({
    id,
    name: overrides.name ?? unique('Client'),
    legalName: overrides.legalName ?? 'Test Client Pvt Ltd',
    ...overrides,
  });
  return { id };
}

export async function createContact(
  db: DrizzleDB,
  clientId: string,
  overrides: Partial<typeof clientContacts.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(clientContacts).values({
    id,
    clientId,
    name: overrides.name ?? unique('Contact'),
    isPrimary: overrides.isPrimary ?? true,
    ...overrides,
  });
  return { id };
}

export async function createRule(
  db: DrizzleDB,
  lawId: string,
  overrides: Partial<typeof complianceRules.$inferInsert> = {},
): Promise<{ id: string; code: string }> {
  const id = overrides.id ?? randomUUID();
  const code = overrides.code ?? unique('RULE');
  await db.insert(complianceRules).values({
    id,
    code,
    name: overrides.name ?? `Rule ${code}`,
    lawId,
    frequency: overrides.frequency ?? 'monthly',
    dueDayOfMonth: overrides.dueDayOfMonth ?? 20,
    dueMonthOffset: overrides.dueMonthOffset ?? 1,
    gracePeriodDays: overrides.gracePeriodDays ?? 0,
    status: overrides.status ?? 'active',
    ...overrides,
  });
  return { id, code };
}

export async function createRegistration(
  db: DrizzleDB,
  clientId: string,
  lawId: string,
  overrides: Partial<typeof complianceClientRegistrations.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(complianceClientRegistrations).values({
    id,
    clientId,
    lawId,
    ...overrides,
  });
  return { id };
}

export async function createLawHandler(
  db: DrizzleDB,
  lawId: string,
  orgEntityId: string,
  overrides: Partial<typeof complianceLawHandlers.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(complianceLawHandlers).values({
    id,
    lawId,
    orgEntityId,
    ...overrides,
  });
  return { id };
}

export async function createFiling(
  db: DrizzleDB,
  params: {
    ruleId: string;
    clientId: string;
    lawId: string;
    assigneeTeamId: string;
    createdBy: string;
  },
  overrides: Partial<typeof complianceFilings.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(complianceFilings).values({
    id,
    title: overrides.title ?? 'Test Filing',
    ruleId: params.ruleId,
    clientId: params.clientId,
    lawId: params.lawId,
    assigneeTeamId: params.assigneeTeamId,
    createdBy: params.createdBy,
    periodStart: overrides.periodStart ?? '2026-03-01',
    periodEnd: overrides.periodEnd ?? '2026-03-31',
    ...overrides,
  });
  return { id };
}

/**
 * Bundles the full prereq chain needed to create a filing: user + org-unit
 * (with level) + law + rule + client + registration. Returns the IDs so tests
 * can assemble the filing payload without repeating boilerplate.
 */
export async function createFilingPrereqs(db: DrizzleDB): Promise<{
  userId: string;
  levelId: string;
  teamId: string;
  lawId: string;
  ruleId: string;
  clientId: string;
  registrationId: string;
}> {
  const { id: userId } = await createUser(db);
  const { id: levelId } = await createOrgUnitLevel(db);
  const { id: teamId } = await createOrgUnit(db, levelId);
  const { id: lawId } = await createLaw(db);
  const { id: ruleId } = await createRule(db, lawId);
  const { id: clientId } = await createClient(db);
  const { id: registrationId } = await createRegistration(db, clientId, lawId);
  return { userId, levelId, teamId, lawId, ruleId, clientId, registrationId };
}
