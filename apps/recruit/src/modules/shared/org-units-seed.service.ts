import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, users } from '@packages/database';
import { OrgUnitService, OrgUnitLevelService, orgUnits } from '@packages/org-units';

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

@Injectable()
export class OrgUnitsSeedService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly orgUnitService: OrgUnitService,
    private readonly orgUnitLevelService: OrgUnitLevelService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OrgUnitsSeedService.name);
  }

  async onApplicationBootstrap() {
    await this.ensureOrgUnits();
  }

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

    const allUsers = await this.database.db
      .select({ id: users.id })
      .from(users);

    let unitCount = 0;

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

      // Assign a random user as a member to leaf teams
      if (!node.children?.length && allUsers.length > 0) {
        const randomUser = allUsers[unitCount % allUsers.length];
        await this.orgUnitService.addMember(unit.id, randomUser.id);
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

    this.logger.log(`Seeded ${unitCount} org units`);
  }
}
