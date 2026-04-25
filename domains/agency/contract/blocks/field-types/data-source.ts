import { defineFieldType } from '@packages/field-types';
import type { FieldTypePlugin, ValidateFn } from '@packages/field-types';

/**
 * Validates a `DataSource` tagged-union value. Mirrors the runtime shape of
 * the `DataSource` type in ../types.ts. Used by the engine on every create /
 * update of a field whose type is `data_source`.
 *
 * The validator runs against parsed JSON (the engine never receives a raw
 * string here — Drizzle's jsonb mode hands back objects), so kind-discriminator
 * checks and per-kind shape checks are both safe.
 */
export const dataSourceValidator: ValidateFn = (value, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { message: `${ctx.label} must be a data source object`, code: 'type' };
  }
  const ds = value as Record<string, unknown>;
  const kind = ds.kind;

  if (kind === 'static') return null;

  if (kind === 'entity-query') {
    if (typeof ds.entity !== 'string' || ds.entity.length === 0) {
      return { message: `${ctx.label}.entity must be a non-empty string`, code: 'format' };
    }
    if (ds.filter !== undefined && (typeof ds.filter !== 'object' || ds.filter === null || Array.isArray(ds.filter))) {
      return { message: `${ctx.label}.filter must be an object`, code: 'format' };
    }
    if (ds.sort !== undefined && typeof ds.sort !== 'string') {
      return { message: `${ctx.label}.sort must be a string`, code: 'format' };
    }
    if (ds.limit !== undefined && (typeof ds.limit !== 'number' || !Number.isInteger(ds.limit) || ds.limit < 1)) {
      return { message: `${ctx.label}.limit must be a positive integer`, code: 'format' };
    }
    return null;
  }

  if (kind === 'entity-ids') {
    if (typeof ds.entity !== 'string' || ds.entity.length === 0) {
      return { message: `${ctx.label}.entity must be a non-empty string`, code: 'format' };
    }
    if (!Array.isArray(ds.ids) || ds.ids.some((id) => typeof id !== 'string')) {
      return { message: `${ctx.label}.ids must be an array of strings`, code: 'format' };
    }
    return null;
  }

  return {
    message: `${ctx.label}.kind must be one of: static, entity-query, entity-ids`,
    code: 'format',
  };
};

const dataSource = defineFieldType({
  type: 'data_source',
  label: 'Data Source',
  family: 'special',
  icon: 'Database',
  color: 'bg-blue-100 text-blue-800',
  sortOrder: 23,
  storage: { type: 'column' },
  validate: dataSourceValidator,
  filterable: false,
  excludeFromList: true,
  sortable: false,
  creatable: false,
});

export const dataSourceFieldTypePlugin: FieldTypePlugin = {
  name: 'blocks-contract',
  fieldTypes: [dataSource],
};
