import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, and, count } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { orgPositions } from '../schema/org-positions';
import { orgPositionScopes } from '../schema/org-position-scopes';
import { orgUnitMembers } from '../schema/org-unit-members';
import type { OrgPosition, OrgPositionScope } from '../types';

@Injectable()
export class OrgPositionService {
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
      .delete(orgPositionScopes)
      .where(eq(orgPositionScopes.positionId, id));
    await this.database.db
      .delete(orgPositions)
      .where(withTenant(orgPositions, eq(orgPositions.id, id)));
  }

  // ---------------------------------------------------------------------------
  // Scope management
  // ---------------------------------------------------------------------------

  async getScopes(positionId: string): Promise<OrgPositionScope[]> {
    await this.findOneOrFail(positionId);
    return this.database.db
      .select()
      .from(orgPositionScopes)
      .where(eq(orgPositionScopes.positionId, positionId)) as Promise<OrgPositionScope[]>;
  }

  async setScopes(positionId: string, scopes: { entityType: string; scope: string }[]): Promise<OrgPositionScope[]> {
    await this.findOneOrFail(positionId);

    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(orgPositionScopes)
        .where(eq(orgPositionScopes.positionId, positionId));

      if (scopes.length > 0) {
        await tx
          .insert(orgPositionScopes)
          .values(scopes.map((s) => ({
            positionId,
            entityType: s.entityType,
            scope: s.scope,
          })));
      }
    });

    return this.getScopes(positionId);
  }

  /**
   * Get the scope for a specific position and entity type.
   * Returns null if no scope is configured (caller should default to 'own').
   */
  async getScopeForEntity(positionId: string, entityType: string): Promise<string | null> {
    const [row] = await this.database.db
      .select({ scope: orgPositionScopes.scope })
      .from(orgPositionScopes)
      .where(and(
        eq(orgPositionScopes.positionId, positionId),
        eq(orgPositionScopes.entityType, entityType),
      ))
      .limit(1);
    return row?.scope ?? null;
  }
}
