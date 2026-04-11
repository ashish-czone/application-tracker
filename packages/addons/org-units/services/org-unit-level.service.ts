import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, count } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { orgUnitLevels } from '../schema/org-unit-levels';
import { orgUnits } from '../schema/org-units';
import type { OrgUnitLevel } from '../types';

const DEFAULT_LEVELS = [
  { name: 'Company', sortOrder: 0 },
  { name: 'Entity', sortOrder: 1 },
  { name: 'Division', sortOrder: 2 },
  { name: 'Team', sortOrder: 3 },
];

@Injectable()
export class OrgUnitLevelService {
  private readonly logger = new Logger(OrgUnitLevelService.name);

  constructor(private readonly database: DatabaseService) {}

  async create(data: { name: string; sortOrder?: number }): Promise<OrgUnitLevel> {
    const [row] = await this.database.db
      .insert(orgUnitLevels)
      .values(withTenantInsert(orgUnitLevels, {
        name: data.name,
        sortOrder: data.sortOrder ?? 0,
      }))
      .returning() as OrgUnitLevel[];
    return row;
  }

  async findAll(): Promise<OrgUnitLevel[]> {
    return this.database.db
      .select()
      .from(orgUnitLevels)
      .where(withTenant(orgUnitLevels))
      .orderBy(orgUnitLevels.sortOrder) as Promise<OrgUnitLevel[]>;
  }

  async findOneOrFail(id: string): Promise<OrgUnitLevel> {
    const [row] = await this.database.db
      .select()
      .from(orgUnitLevels)
      .where(withTenant(orgUnitLevels, eq(orgUnitLevels.id, id)))
      .limit(1) as OrgUnitLevel[];
    if (!row) throw new NotFoundException('Org unit level not found');
    return row;
  }

  async update(id: string, data: Partial<{ name: string; sortOrder: number }>): Promise<OrgUnitLevel> {
    await this.findOneOrFail(id);
    const [row] = await this.database.db
      .update(orgUnitLevels)
      .set(data)
      .where(withTenant(orgUnitLevels, eq(orgUnitLevels.id, id)))
      .returning() as OrgUnitLevel[];
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.findOneOrFail(id);

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(orgUnits)
      .where(eq(orgUnits.levelId, id));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a level that is assigned to org units. Remove all units using this level first.');
    }

    await this.database.db
      .delete(orgUnitLevels)
      .where(withTenant(orgUnitLevels, eq(orgUnitLevels.id, id)));
  }

  async seedDefaults(): Promise<void> {
    const existing = await this.database.db
      .select({ id: orgUnitLevels.id })
      .from(orgUnitLevels)
      .limit(1);

    if (existing.length > 0) return;

    for (const level of DEFAULT_LEVELS) {
      await this.database.db
        .insert(orgUnitLevels)
        .values({ name: level.name, sortOrder: level.sortOrder });
    }

    this.logger.log('Seeded default org unit levels: Company, Entity, Division, Team');
  }
}
