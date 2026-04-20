import { getTableName } from 'drizzle-orm';
import type { EntityConfig, FieldType } from '../types';

/**
 * Map a custom-field type to the SQL cast used in its expression index.
 * Mirrors the casts applied by the JSONB sort path so the optimizer can use
 * the index for ORDER BY and comparison operators.
 */
function jsonbIndexCast(fieldType: FieldType): string | null {
  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'decimal':
      return 'numeric';
    case 'date':
      return 'date';
    case 'datetime':
      return 'timestamptz';
    case 'boolean':
      return 'boolean';
    default:
      return null;
  }
}

function tableName(config: EntityConfig): string {
  return getTableName(config.table as any);
}

/**
 * Generate a stable, deterministic index name.
 * Format: idx_<table>_cf_<fieldKey> — truncated to 63 chars (Postgres limit).
 */
function indexName(table: string, fieldKey: string): string {
  const raw = `idx_${table}_cf_${fieldKey}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return raw.length > 63 ? raw.slice(0, 63) : raw;
}

export interface JsonbIndexStatement {
  entityType: string;
  table: string;
  fieldKey: string;
  fieldType: FieldType;
  indexName: string;
  sql: string;
}

/**
 * For a single entity config, emit one CREATE INDEX statement per field meta
 * entry with `indexed: true`. Only applies to entities using JSONB storage
 * (customFields === true). Uses CONCURRENTLY so the migration does not block
 * writes; CONCURRENTLY requires the statement to run outside a transaction, so
 * migration runners must execute each statement in autocommit mode.
 */
export function generateJsonbIndexesForEntity(config: EntityConfig): JsonbIndexStatement[] {
  if (config.customFields !== true) return [];

  const table = tableName(config);
  const statements: JsonbIndexStatement[] = [];

  for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
    if (!meta.indexed) continue;
    if (meta.isSystem) continue; // system fields live on schema columns, not JSONB

    const fieldType = meta.fieldType ?? 'text';
    const cast = jsonbIndexCast(fieldType);
    const name = indexName(table, fieldKey);
    const expression = cast
      ? `((custom_fields ->> '${fieldKey}')::${cast})`
      : `((custom_fields ->> '${fieldKey}'))`;

    statements.push({
      entityType: config.entityType,
      table,
      fieldKey,
      fieldType,
      indexName: name,
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} ${expression};`,
    });
  }

  return statements;
}

/**
 * Iterate every registered entity and collect the full set of expression-index
 * statements. Consumers write the result to a migration file.
 */
export function generateJsonbIndexes(configs: EntityConfig[]): JsonbIndexStatement[] {
  return configs.flatMap((c) => generateJsonbIndexesForEntity(c));
}
