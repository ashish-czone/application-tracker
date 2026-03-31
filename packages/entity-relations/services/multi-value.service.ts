import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { entityMultiValues } from '../schema/entity-multi-values';

/**
 * Manages multi-value relational fields (multi_user, multi_lookup).
 * Uses the entity_multi_values junction table to store multiple target references
 * per entity field.
 */
@Injectable()
export class MultiValueService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Get all target IDs for a specific entity field.
   */
  async getValues(entityType: string, entityId: string, fieldKey: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ targetId: entityMultiValues.targetId })
      .from(entityMultiValues)
      .where(and(
        eq(entityMultiValues.entityType, entityType),
        eq(entityMultiValues.entityId, entityId),
        eq(entityMultiValues.fieldKey, fieldKey),
      ))
      .orderBy(entityMultiValues.sortOrder);

    return rows.map(r => r.targetId);
  }

  /**
   * Get all multi-value fields for an entity, grouped by field key.
   */
  async getAllForEntity(entityType: string, entityId: string): Promise<Record<string, string[]>> {
    const rows = await this.database.db
      .select({
        fieldKey: entityMultiValues.fieldKey,
        targetId: entityMultiValues.targetId,
      })
      .from(entityMultiValues)
      .where(and(
        eq(entityMultiValues.entityType, entityType),
        eq(entityMultiValues.entityId, entityId),
      ))
      .orderBy(entityMultiValues.fieldKey, entityMultiValues.sortOrder);

    const result: Record<string, string[]> = {};
    for (const row of rows) {
      if (!result[row.fieldKey]) result[row.fieldKey] = [];
      result[row.fieldKey].push(row.targetId);
    }
    return result;
  }

  /**
   * Set the target IDs for a field, replacing any existing values.
   * Performs a delete + insert. Uses caller's transaction if provided,
   * otherwise creates its own.
   */
  async setValues(
    entityType: string,
    entityId: string,
    fieldKey: string,
    targetIds: string[],
    tx?: any,
  ): Promise<void> {
    const doWork = async (db: any) => {
      // Remove existing values for this field
      await db
        .delete(entityMultiValues)
        .where(and(
          eq(entityMultiValues.entityType, entityType),
          eq(entityMultiValues.entityId, entityId),
          eq(entityMultiValues.fieldKey, fieldKey),
        ));

      // Insert new values
      if (targetIds.length > 0) {
        await db.insert(entityMultiValues).values(
          targetIds.map((targetId, index) => ({
            entityType,
            entityId,
            fieldKey,
            targetId,
            sortOrder: index,
          })),
        );
      }
    };

    if (tx) {
      await doWork(tx);
    } else {
      await this.database.db.transaction(doWork);
    }
  }

  /**
   * Remove all multi-values for an entity (used on entity delete).
   */
  async removeAllForEntity(entityType: string, entityId: string): Promise<void> {
    await this.database.db
      .delete(entityMultiValues)
      .where(and(
        eq(entityMultiValues.entityType, entityType),
        eq(entityMultiValues.entityId, entityId),
      ));
  }

  /**
   * Find all entities that have a specific target in a specific field.
   * Useful for reverse lookups: "which job openings have user X as assigned recruiter?"
   */
  async findEntitiesByTarget(
    entityType: string,
    fieldKey: string,
    targetId: string,
  ): Promise<string[]> {
    const rows = await this.database.db
      .select({ entityId: entityMultiValues.entityId })
      .from(entityMultiValues)
      .where(and(
        eq(entityMultiValues.entityType, entityType),
        eq(entityMultiValues.fieldKey, fieldKey),
        eq(entityMultiValues.targetId, targetId),
      ));

    return rows.map(r => r.entityId);
  }
}
