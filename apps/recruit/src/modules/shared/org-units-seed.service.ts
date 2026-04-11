import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, users, eq, isNull } from '@packages/database';
import { UsersService } from '@packages/users';
import { RbacService } from '@packages/rbac';
import {
  OrgUnitService,
  OrgUnitLevelService,
  OrgPositionService,
  orgUnits,
  orgPositionScopes,
} from '@packages/org-units';
import { tasks } from '@packages/tasks';

interface SeedNode {
  name: string;
  levelName: string;
  children?: SeedNode[];
}

const ORG_TREE: SeedNode[] = [
  {
    name: 'Acme Corporation',
    levelName: 'Company',
    children: [
      {
        name: 'Acme North America',
        levelName: 'Entity',
        children: [
          {
            name: 'Engineering',
            levelName: 'Division',
            children: [
              { name: 'Frontend Team', levelName: 'Team' },
              { name: 'Backend Team', levelName: 'Team' },
              { name: 'DevOps Team', levelName: 'Team' },
            ],
          },
          {
            name: 'Sales',
            levelName: 'Division',
            children: [
              { name: 'Enterprise Sales', levelName: 'Team' },
              { name: 'SMB Sales', levelName: 'Team' },
            ],
          },
          {
            name: 'Human Resources',
            levelName: 'Division',
            children: [
              { name: 'Talent Acquisition', levelName: 'Team' },
              { name: 'People Operations', levelName: 'Team' },
            ],
          },
        ],
      },
      {
        name: 'Acme Europe',
        levelName: 'Entity',
        children: [
          {
            name: 'Product',
            levelName: 'Division',
            children: [
              { name: 'Design Team', levelName: 'Team' },
              { name: 'QA Team', levelName: 'Team' },
            ],
          },
          {
            name: 'Operations',
            levelName: 'Division',
            children: [
              { name: 'Support Team', levelName: 'Team' },
            ],
          },
        ],
      },
    ],
  },
];

const SEED_USERS = [
  { firstName: 'Emma', lastName: 'Williams', email: 'emma.williams@acme.example.com' },
  { firstName: 'Liam', lastName: 'Brown', email: 'liam.brown@acme.example.com' },
  { firstName: 'Olivia', lastName: 'Garcia', email: 'olivia.garcia@acme.example.com' },
  { firstName: 'Noah', lastName: 'Martinez', email: 'noah.martinez@acme.example.com' },
  { firstName: 'Ava', lastName: 'Anderson', email: 'ava.anderson@acme.example.com' },
  { firstName: 'Ethan', lastName: 'Thomas', email: 'ethan.thomas@acme.example.com' },
  { firstName: 'Sophia', lastName: 'Jackson', email: 'sophia.jackson@acme.example.com' },
  { firstName: 'Mason', lastName: 'White', email: 'mason.white@acme.example.com' },
  { firstName: 'Isabella', lastName: 'Harris', email: 'isabella.harris@acme.example.com' },
  { firstName: 'Lucas', lastName: 'Clark', email: 'lucas.clark@acme.example.com' },
  { firstName: 'Mia', lastName: 'Lewis', email: 'mia.lewis@acme.example.com' },
  { firstName: 'Alexander', lastName: 'Robinson', email: 'alexander.robinson@acme.example.com' },
  { firstName: 'Charlotte', lastName: 'Walker', email: 'charlotte.walker@acme.example.com' },
  { firstName: 'James', lastName: 'Young', email: 'james.young@acme.example.com' },
  { firstName: 'Amelia', lastName: 'King', email: 'amelia.king@acme.example.com' },
];

// Team name → [leadIndex, ...memberIndices] into SEED_USERS
const TEAM_ASSIGNMENTS: Record<string, number[]> = {
  'Frontend Team':      [0, 1, 2],
  'Backend Team':       [3, 4],
  'DevOps Team':        [5, 6],
  'Enterprise Sales':   [7, 8],
  'SMB Sales':          [9],
  'Talent Acquisition': [10, 11],
  'People Operations':  [12],
  'Design Team':        [13],
  'QA Team':            [14],
  'Support Team':       [2, 10],
};

// Position scopes: Head/Lead → descendants, Member → unit
const POSITION_SCOPES: { positionName: string; entityType: string; scope: string }[] = [
  { positionName: 'Head', entityType: 'tasks', scope: 'descendants' },
  { positionName: 'Lead', entityType: 'tasks', scope: 'descendants' },
  { positionName: 'Member', entityType: 'tasks', scope: 'unit' },
];

// Sample tasks assigned to teams
const SAMPLE_TASKS: { title: string; priority: string; teamName: string; dueOffset: number }[] = [
  { title: 'Set up CI/CD pipeline for new microservice', priority: 'high', teamName: 'DevOps Team', dueOffset: 7 },
  { title: 'Fix responsive layout on dashboard', priority: 'medium', teamName: 'Frontend Team', dueOffset: 3 },
  { title: 'Implement user authentication API', priority: 'high', teamName: 'Backend Team', dueOffset: 5 },
  { title: 'Prepare Q3 enterprise pitch deck', priority: 'urgent', teamName: 'Enterprise Sales', dueOffset: 2 },
  { title: 'Update SMB pricing page copy', priority: 'low', teamName: 'SMB Sales', dueOffset: 10 },
  { title: 'Screen 20 candidates for senior engineer role', priority: 'high', teamName: 'Talent Acquisition', dueOffset: 4 },
  { title: 'Roll out new PTO policy', priority: 'medium', teamName: 'People Operations', dueOffset: 14 },
  { title: 'Design onboarding flow mockups', priority: 'high', teamName: 'Design Team', dueOffset: 6 },
  { title: 'Write E2E tests for checkout flow', priority: 'medium', teamName: 'QA Team', dueOffset: 5 },
  { title: 'Resolve P1 customer ticket #4821', priority: 'urgent', teamName: 'Support Team', dueOffset: 1 },
  { title: 'Migrate database to PostgreSQL 17', priority: 'medium', teamName: 'DevOps Team', dueOffset: 21 },
  { title: 'Build reusable data table component', priority: 'medium', teamName: 'Frontend Team', dueOffset: 8 },
  { title: 'Optimize bulk import endpoint', priority: 'low', teamName: 'Backend Team', dueOffset: 14 },
  { title: 'Follow up with Globex Industries deal', priority: 'high', teamName: 'Enterprise Sales', dueOffset: 3 },
  { title: 'Update employee handbook', priority: 'low', teamName: 'People Operations', dueOffset: 30 },
];

@Injectable()
export class OrgUnitsSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
    private readonly orgUnitService: OrgUnitService,
    private readonly orgUnitLevelService: OrgUnitLevelService,
    private readonly orgPositionService: OrgPositionService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OrgUnitsSeedService.name);
  }

  async onApplicationBootstrap() {
    await this.ensureSeedUsers();
    await this.ensureOrgUnits();
    await this.ensurePositionScopes();
    await this.ensureSampleTasks();
  }

  // ---------------------------------------------------------------------------
  // Seed users
  // ---------------------------------------------------------------------------

  private async ensureSeedUsers() {
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, SEED_USERS[0].email))
      .limit(1);

    if (existing) return;

    const defaultRole = await this.rbacService.findDefaultRoleForUserType('client');
    if (!defaultRole) {
      this.logger.warn('No default client role found — skipping user seeding');
      return;
    }

    const [admin] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(isNull(users.deletedAt))
      .limit(1);

    if (!admin) {
      this.logger.warn('No admin user found — skipping user seeding');
      return;
    }

    for (const u of SEED_USERS) {
      await this.usersService.create({
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        password: 'Password123',
        userType: 'client',
        roleIds: [defaultRole.id],
      }, admin.id);
    }

    this.logger.log(`Seeded ${SEED_USERS.length} users`);
  }

  // ---------------------------------------------------------------------------
  // Seed org units + assign members
  // ---------------------------------------------------------------------------

  private async ensureOrgUnits() {
    const [existing] = await this.database.db
      .select({ id: orgUnits.id })
      .from(orgUnits)
      .limit(1);

    if (existing) return;

    const levels = await this.orgUnitLevelService.findAll();
    if (levels.length === 0) {
      this.logger.warn('No org unit levels found — skipping org unit seeding');
      return;
    }

    const levelByName = new Map(levels.map((l) => [l.name, l.id]));

    // Resolve positions by name
    const positions = await this.orgPositionService.findAll();
    const leadPositionId = positions.find((p) => p.name === 'Lead')?.id;
    const memberPositionId = positions.find((p) => p.name === 'Member')?.id;

    // Build email → userId map for seed users
    const seedEmails = SEED_USERS.map((u) => u.email);
    const allUsers = await this.database.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(isNull(users.deletedAt));

    const userByEmail = new Map(allUsers.map((u) => [u.email, u.id]));
    const seedUserIds = seedEmails.map((e) => userByEmail.get(e)).filter(Boolean) as string[];

    let unitCount = 0;
    const teamUnits = new Map<string, string>(); // team name → unit id

    const seedNode = async (node: SeedNode, parentId?: string, sortOrder = 0) => {
      const levelId = levelByName.get(node.levelName);
      if (!levelId) {
        this.logger.warn(`Level "${node.levelName}" not found — skipping "${node.name}"`);
        return;
      }

      const unit = await this.orgUnitService.create({
        name: node.name,
        parentId,
        levelId,
        sortOrder,
      });
      unitCount++;

      if (!node.children?.length) {
        teamUnits.set(node.name, unit.id);
      }

      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          await seedNode(node.children[i], unit.id, i);
        }
      }
    };

    for (let i = 0; i < ORG_TREE.length; i++) {
      await seedNode(ORG_TREE[i], undefined, i);
    }

    // Assign members to teams
    let memberCount = 0;
    for (const [teamName, indices] of Object.entries(TEAM_ASSIGNMENTS)) {
      const unitId = teamUnits.get(teamName);
      if (!unitId) continue;

      for (let i = 0; i < indices.length; i++) {
        const userId = seedUserIds[indices[i]];
        if (!userId) continue;

        const positionId = i === 0 ? leadPositionId : memberPositionId;
        await this.orgUnitService.addMember(unitId, userId, positionId ?? undefined);
        memberCount++;
      }
    }

    this.logger.log(`Seeded ${unitCount} org units with ${memberCount} member assignments`);
  }

  // ---------------------------------------------------------------------------
  // Seed position scopes (Head/Lead → descendants, Member → unit)
  // ---------------------------------------------------------------------------

  private async ensurePositionScopes() {
    const [existing] = await this.database.db
      .select({ positionId: orgPositionScopes.positionId })
      .from(orgPositionScopes)
      .limit(1);

    if (existing) return;

    const positions = await this.orgPositionService.findAll();
    const positionByName = new Map(positions.map((p) => [p.name, p.id]));

    let scopeCount = 0;
    for (const { positionName, entityType, scope } of POSITION_SCOPES) {
      const positionId = positionByName.get(positionName);
      if (!positionId) continue;

      await this.database.db
        .insert(orgPositionScopes)
        .values({ positionId, entityType, scope })
        .onConflictDoNothing();
      scopeCount++;
    }

    this.logger.log(`Seeded ${scopeCount} position scopes for tasks`);
  }

  // ---------------------------------------------------------------------------
  // Seed sample tasks assigned to teams
  // ---------------------------------------------------------------------------

  private async ensureSampleTasks() {
    const [existing] = await this.database.db
      .select({ id: tasks.id })
      .from(tasks)
      .limit(1);

    if (existing) return;

    const [admin] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(isNull(users.deletedAt))
      .limit(1);

    if (!admin) return;

    // Build team name → unit id map
    const unitRows = await this.database.db
      .select({ id: orgUnits.id, name: orgUnits.name })
      .from(orgUnits);
    const unitByName = new Map(unitRows.map((u) => [u.name, u.id]));

    const now = Date.now();
    let taskCount = 0;

    for (const task of SAMPLE_TASKS) {
      const teamId = unitByName.get(task.teamName);
      if (!teamId) continue;

      const dueDate = new Date(now + task.dueOffset * 24 * 60 * 60 * 1000);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      await this.database.db.insert(tasks).values({
        title: task.title,
        priority: task.priority,
        assigneeTeamId: teamId,
        dueDate: dueDateStr,
        createdBy: admin.id,
      });
      taskCount++;
    }

    this.logger.log(`Seeded ${taskCount} sample tasks`);
  }
}
