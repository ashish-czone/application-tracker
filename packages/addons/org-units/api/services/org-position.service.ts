import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, count } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { orgPositions } from '../schema/org-positions';
import { orgUnitMembers } from '../schema/org-unit-members';
import type { OrgPosition } from '../types';

/** Default positions seeded on first startup */
const DEFAULT_POSITIONS = [
  { name: 'Head', sortOrder: 0 },
  { name: 'Lead', sortOrder: 1 },
  { name: 'Member', sortOrder: 2 },
];

@Injectable()
export class OrgPositionService {
  private readonly logger = new Logger(OrgPositionService.name);

  constructor(private readonly database: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(data: { name: string; sortOrder?: number }): Promise<OrgPosition> {
    const [row] = await this.database.db
      .insert(orgPositions)
      .values(withTenantInsert(orgPositions, {
        name: data.name,
        sortOrder: data.sortOrder ?? 0,
      }))
      .returning() as OrgPosition[];
    return row;
  }

  async findAll(): Promise<OrgPosition[]> {
    return this.database.db
      .select()
      .from(orgPositions)
      .where(withTenant(orgPositions))
      .orderBy(orgPositions.sortOrder) as Promise<OrgPosition[]>;
  }

  async findOneOrFail(id: string): Promise<OrgPosition> {
    const [row] = await this.database.db
      .select()
      .from(orgPositions)
      .where(withTenant(orgPositions, eq(orgPositions.id, id)))
      .limit(1) as OrgPosition[];
    if (!row) throw new NotFoundException('Org position not found');
    return row;
  }

  async update(id: string, data: Partial<{ name: string; sortOrder: number }>): Promise<OrgPosition> {
    await this.findOneOrFail(id);
    const [row] = await this.database.db
      .update(orgPositions)
      .set(data)
      .where(withTenant(orgPositions, eq(orgPositions.id, id)))
      .returning() as OrgPosition[];
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.findOneOrFail(id);

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(orgUnitMembers)
      .where(eq(orgUnitMembers.positionId, id));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a position that is assigned to org unit members. Remove the position from all members first.');
    }

    await this.database.db
      .delete(orgPositions)
      .where(withTenant(orgPositions, eq(orgPositions.id, id)));
  }

  // ---------------------------------------------------------------------------
  // Seeding
  // ---------------------------------------------------------------------------

  /**
   * Seeds default positions (Head, Lead, Member) if none exist.
   * Called from OrgUnitsModule.onModuleInit.
   */
  async seedDefaults(): Promise<void> {
    const existing = await this.database.db
      .select({ id: orgPositions.id })
      .from(orgPositions)
      .limit(1);

    if (existing.length > 0) return;

    for (const pos of DEFAULT_POSITIONS) {
      await this.database.db
        .insert(orgPositions)
        .values({
          name: pos.name,
          sortOrder: pos.sortOrder,
        });
    }

    this.logger.log('Seeded default org positions: Head, Lead, Member');
  }
}
