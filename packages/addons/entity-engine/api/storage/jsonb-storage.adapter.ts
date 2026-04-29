import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, sql, inArray } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { EntityRegistryService } from '../entity-registry.service';
import type { EavStorageExtension } from '../extensions/eav-storage.interface';
import type { FilterOperator } from '../types';

type Filter = { fieldKey: string; operator: FilterOperator; value: any };

/**
 * Storage adapter that reads/writes custom field values from a `custom_fields`
 * JSONB column on each entity's own table.
 *
 * This is the default storage when an entity declares `customFields: true`.
 * Tables must spread `...customFieldsColumn()` — validated at `defineEntity()`.
 */
@Injectable()
export class JsonbStorageAdapter implements EavStorageExtension {
  constructor(
    private readonly database: DatabaseService,
    private readonly registry: EntityRegistryService,
  ) {}

  async getValues(entityType: string, entityId: string, tx?: any): Promise<Record<string, unknown>> {
    const db = tx ?? this.database.db;
    const table = this.resolveTable(entityType);

    const rows = await db
      .select({ customFields: table.customFields })
      .from(table)
      .where(withTenant(table, eq(table.id, entityId)))
      .limit(1);

    if (rows.length === 0) return {};
    return (rows[0].customFields ?? {}) as Record<string, unknown>;
  }

  async getBatchValues(entityType: string, entityIds: string[]): Promise<Map<string, Record<string, unknown>>> {
    const result = new Map<string, Record<string, unknown>>();
    if (entityIds.length === 0) return result;

    const table = this.resolveTable(entityType);

    const rows = await this.database.db
      .select({ id: table.id, customFields: table.customFields })
      .from(table)
      .where(withTenant(table, inArray(table.id, entityIds)));

    for (const row of rows) {
      result.set(row.id as string, (row.customFields ?? {}) as Record<string, unknown>);
    }
    return result;
  }

  async setValues(
    entityType: string,
    entityId: string,
    values: Record<string, unknown>,
    tx?: any,
  ): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
    const db = tx ?? this.database.db;
    const table = this.resolveTable(entityType);

    const before = await this.getValues(entityType, entityId, db);

    const after = { ...before };
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || value === '') {
        delete after[key];
      } else {
        after[key] = value;
      }
    }

    await db
      .update(table)
      .set({ customFields: after })
      .where(withTenant(table, eq(table.id, entityId)));

    return { before, after };
  }

  buildFilterCondition(entityType: string, entityIdColumn: any, filters: Filter[]): any {
    if (filters.length === 0) return sql`true`;

    const table = this.resolveTable(entityType);
    const columnRef = table.customFields;

    const conditions = filters.map((f) => {
      const text = sql`${columnRef} ->> ${f.fieldKey}`;
      const jsonNode = sql`${columnRef} -> ${f.fieldKey}`;

      switch (f.operator) {
        case 'eq':
          return sql`${text} = ${String(f.value)}`;
        case 'neq':
          return sql`(${text} IS DISTINCT FROM ${String(f.value)})`;
        case 'gt':
          return sql`(${text})::numeric > ${Number(f.value)}`;
        case 'gte':
          return sql`(${text})::numeric >= ${Number(f.value)}`;
        case 'lt':
          return sql`(${text})::numeric < ${Number(f.value)}`;
        case 'lte':
          return sql`(${text})::numeric <= ${Number(f.value)}`;
        case 'like':
          return sql`${text} ILIKE ${'%' + String(f.value) + '%'}`;
        case 'contains':
          return sql`${jsonNode} ? ${String(f.value)}`;
        case 'in': {
          const arr = Array.isArray(f.value) ? f.value : [f.value];
          const placeholders = arr.map((v) => sql`${String(v)}`);
          return sql`${text} IN (${sql.join(placeholders, sql`, `)})`;
        }
        default:
          return sql`${text} = ${String(f.value)}`;
      }
    });

    return sql.join(
      conditions.map((c) => sql`(${c})`),
      sql` AND `,
    );
  }

  async checkUniqueness(
    entityType: string,
    fieldKey: string,
    value: unknown,
    excludeEntityId?: string,
  ): Promise<boolean> {
    const table = this.resolveTable(entityType);

    const conditions = [sql`${table.customFields} ->> ${fieldKey} = ${String(value)}`];
    if (excludeEntityId) {
      conditions.push(sql`${table.id} != ${excludeEntityId}`);
    }

    const [row] = await this.database.db
      .select({ exists: sql<boolean>`true` })
      .from(table)
      .where(withTenant(table, ...conditions))
      .limit(1);

    return !row;
  }

  private resolveTable(entityType: string): any {
    const config = this.registry.getOrFail(entityType);
    const table = config.table as any;
    if (!table.customFields) {
      throw new Error(
        `Entity '${entityType}' uses JSONB custom fields but its table lacks a customFields column. ` +
          `Spread ...customFieldsColumn() into the table definition.`,
      );
    }
    return table;
  }
}
