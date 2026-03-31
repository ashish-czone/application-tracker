import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and, sql, inArray } from '@packages/database';
import { entityFieldValues } from '../schema/entity-field-values';
import { fieldDefinitions } from '../schema/field-definitions';
import { fieldTypeRegistry } from '@packages/field-types';
import type { EavValueColumn } from '@packages/field-types';
import type { FieldFilter, FieldType } from '../types';

@Injectable()
export class FieldValueService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Get all custom field values for a single entity instance.
   * Returns { fieldKey: typedValue } map.
   * Accepts optional Drizzle transaction for transactional reads.
   */
  async getValues(entityType: string, entityId: string, tx?: any): Promise<Record<string, unknown>> {
    const db = tx ?? this.database.db;

    const rows = await db
      .select()
      .from(entityFieldValues)
      .where(and(
        eq(entityFieldValues.entityType, entityType),
        eq(entityFieldValues.entityId, entityId),
      ));

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.fieldKey] = this.extractValue(row);
    }
    return result;
  }

  /**
   * Get custom field values for multiple entities (batch, for list views).
   * Single query, grouped by entity ID.
   */
  async getBatchValues(
    entityType: string,
    entityIds: string[],
    fieldKeys?: string[],
  ): Promise<Map<string, Record<string, unknown>>> {
    if (entityIds.length === 0) return new Map();

    const conditions = [
      eq(entityFieldValues.entityType, entityType),
      inArray(entityFieldValues.entityId, entityIds),
    ];

    if (fieldKeys && fieldKeys.length > 0) {
      conditions.push(inArray(entityFieldValues.fieldKey, fieldKeys));
    }

    const rows = await this.database.db
      .select()
      .from(entityFieldValues)
      .where(and(...conditions));

    const result = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      if (!result.has(row.entityId)) {
        result.set(row.entityId, {});
      }
      result.get(row.entityId)![row.fieldKey] = this.extractValue(row);
    }

    return result;
  }

  /**
   * Set custom field values for an entity instance.
   * Upserts into EAV table, routing values to the correct typed column.
   * Accepts optional Drizzle transaction for transactional writes.
   * Returns { before, after } snapshots of EAV values.
   */
  async setValues(
    entityType: string,
    entityId: string,
    values: Record<string, unknown>,
    tx?: any,
  ): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
    const db = tx ?? this.database.db;

    // Read current EAV values before mutation
    const before = await this.getValues(entityType, entityId, db);

    const fieldKeys = Object.keys(values);
    if (fieldKeys.length === 0) return { before, after: { ...before } };

    const fields = await db
      .select()
      .from(fieldDefinitions)
      .where(and(
        eq(fieldDefinitions.entityType, entityType),
        inArray(fieldDefinitions.fieldKey, fieldKeys),
      ));

    const fieldTypeMap = new Map<string, FieldType>(fields.map((f: { fieldKey: string; fieldType: string }) => [f.fieldKey, f.fieldType as FieldType]));

    // Compute after by cloning before and applying changes
    const after = { ...before };

    for (const [key, value] of Object.entries(values)) {
      const fieldType = fieldTypeMap.get(key);
      if (!fieldType) continue; // Skip unknown fields

      if (value === null || value === undefined || value === '') {
        // Delete the value row
        await db
          .delete(entityFieldValues)
          .where(and(
            eq(entityFieldValues.entityType, entityType),
            eq(entityFieldValues.entityId, entityId),
            eq(entityFieldValues.fieldKey, key),
          ));
        delete after[key];
        continue;
      }

      const valueColumn = fieldTypeRegistry.getEavColumn(fieldType);
      if (!valueColumn) {
        // Relational field types (tags, file, category) don't use EAV storage
        continue;
      }
      const typedValues = this.buildTypedValues(valueColumn, value);

      // Upsert
      await db
        .insert(entityFieldValues)
        .values({
          entityType,
          entityId,
          fieldKey: key,
          ...typedValues,
        })
        .onConflictDoUpdate({
          target: [entityFieldValues.entityType, entityFieldValues.entityId, entityFieldValues.fieldKey],
          set: typedValues,
        });

      // Record the applied value in after snapshot
      after[key] = this.extractTypedValue(valueColumn, typedValues);
    }

    return { before, after };
  }

  /**
   * Delete all custom field values for an entity instance.
   * Call this when the entity is deleted.
   */
  async deleteValues(entityType: string, entityId: string): Promise<void> {
    await this.database.db
      .delete(entityFieldValues)
      .where(and(
        eq(entityFieldValues.entityType, entityType),
        eq(entityFieldValues.entityId, entityId),
      ));
  }

  /**
   * Check uniqueness for a custom field value across entities.
   * Returns true if the value is unique (safe to use).
   */
  async checkUniqueness(
    entityType: string,
    fieldKey: string,
    value: unknown,
    excludeEntityId?: string,
  ): Promise<boolean> {
    const field = await this.database.db
      .select()
      .from(fieldDefinitions)
      .where(and(
        eq(fieldDefinitions.entityType, entityType),
        eq(fieldDefinitions.fieldKey, fieldKey),
      ))
      .limit(1);

    if (!field[0] || !field[0].isUnique) return true;

    const valueColumn = fieldTypeRegistry.getEavColumn(field[0].fieldType);
    if (!valueColumn) return true; // Relational types don't have EAV uniqueness
    const columnRef = this.getColumnRef(valueColumn);

    const conditions = [
      eq(entityFieldValues.entityType, entityType),
      eq(entityFieldValues.fieldKey, fieldKey),
      sql`${columnRef} = ${String(value)}`,
    ];

    if (excludeEntityId) {
      conditions.push(sql`${entityFieldValues.entityId} != ${excludeEntityId}`);
    }

    const [result] = await this.database.db
      .select({ exists: sql<boolean>`true` })
      .from(entityFieldValues)
      .where(and(...conditions))
      .limit(1);

    return !result;
  }

  /**
   * Build an SQL EXISTS subquery for filtering entities by custom field values.
   * Returns a raw SQL condition that can be AND'd into the main entity query.
   *
   * Usage in domain service:
   *   const condition = fieldValueService.buildFilterCondition('candidates', entityIdColumn, filters);
   *   query.where(and(...otherConditions, condition));
   */
  buildFilterCondition(
    entityType: string,
    entityIdColumn: any,
    filters: FieldFilter[],
  ): any {
    if (filters.length === 0) return sql`true`;

    const conditions = filters.map(filter => {
      const { fieldKey, operator, value } = filter;

      let valueCondition: any;
      switch (operator) {
        case 'eq':
          valueCondition = sql`(efv.value_text = ${String(value)} OR efv.value_number = ${Number(value)} OR efv.value_boolean = ${Boolean(value)})`;
          break;
        case 'neq':
          valueCondition = sql`(efv.value_text != ${String(value)} OR efv.value_number != ${Number(value)})`;
          break;
        case 'gt':
          valueCondition = sql`efv.value_number > ${Number(value)}`;
          break;
        case 'gte':
          valueCondition = sql`efv.value_number >= ${Number(value)}`;
          break;
        case 'lt':
          valueCondition = sql`efv.value_number < ${Number(value)}`;
          break;
        case 'lte':
          valueCondition = sql`efv.value_number <= ${Number(value)}`;
          break;
        case 'like':
          valueCondition = sql`efv.value_text ILIKE ${'%' + String(value) + '%'}`;
          break;
        case 'contains':
          // For multi_select JSON arrays
          valueCondition = sql`efv.value_text::jsonb ? ${String(value)}`;
          break;
        case 'in': {
          const arr = Array.isArray(value) ? value : [value];
          const placeholders = arr.map(v => sql`${String(v)}`);
          valueCondition = sql`efv.value_text IN (${sql.join(placeholders, sql`, `)})`;
          break;
        }
        default:
          valueCondition = sql`efv.value_text = ${String(value)}`;
      }

      return sql`EXISTS (
        SELECT 1 FROM entity_field_values efv
        WHERE efv.entity_type = ${entityType}
          AND efv.entity_id = ${entityIdColumn}
          AND efv.field_key = ${fieldKey}
          AND ${valueCondition}
      )`;
    });

    return sql.join(conditions, sql` AND `);
  }

  // --- Private helpers ---

  private extractValue(row: {
    valueText: string | null;
    valueNumber: string | null;
    valueDate: string | null;
    valueDatetime: Date | null;
    valueBoolean: boolean | null;
  }): unknown {
    if (row.valueBoolean !== null) return row.valueBoolean;
    if (row.valueNumber !== null) return Number(row.valueNumber);
    if (row.valueDatetime !== null) return row.valueDatetime;
    if (row.valueDate !== null) return row.valueDate;
    if (row.valueText !== null) return row.valueText;
    return null;
  }

  /**
   * Extract the typed value from a set of typed column values.
   * Used to compute the "after" snapshot without re-reading from DB.
   */
  private extractTypedValue(column: EavValueColumn, typedValues: Record<string, unknown>): unknown {
    switch (column) {
      case 'valueText': return typedValues.valueText;
      case 'valueNumber': return Number(typedValues.valueNumber);
      case 'valueDate': return typedValues.valueDate;
      case 'valueDatetime': return typedValues.valueDatetime;
      case 'valueBoolean': return typedValues.valueBoolean;
    }
  }

  private buildTypedValues(column: EavValueColumn, value: unknown): Record<string, unknown> {
    // Clear all columns, set only the target
    const values: Record<string, unknown> = {
      valueText: null,
      valueNumber: null,
      valueDate: null,
      valueDatetime: null,
      valueBoolean: null,
    };

    switch (column) {
      case 'valueText':
        values.valueText = typeof value === 'object' ? JSON.stringify(value) : String(value);
        break;
      case 'valueNumber':
        values.valueNumber = String(Number(value));
        break;
      case 'valueDate':
        values.valueDate = String(value);
        break;
      case 'valueDatetime':
        values.valueDatetime = value instanceof Date ? value : new Date(String(value));
        break;
      case 'valueBoolean':
        values.valueBoolean = Boolean(value);
        break;
    }

    return values;
  }

  private getColumnRef(column: EavValueColumn) {
    switch (column) {
      case 'valueText': return entityFieldValues.valueText;
      case 'valueNumber': return entityFieldValues.valueNumber;
      case 'valueDate': return entityFieldValues.valueDate;
      case 'valueDatetime': return entityFieldValues.valueDatetime;
      case 'valueBoolean': return entityFieldValues.valueBoolean;
    }
  }
}
