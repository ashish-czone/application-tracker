import { getTableColumns } from 'drizzle-orm';
import type {
  EntityConfig,
  FieldDefinition,
  FieldType,
  FullLayout,
  FullLayoutField,
  FullLayoutSection,
  PicklistOption,
  SetPicklistOptionInput,
} from '../types';

// Epoch is used for the synthesized createdAt/updatedAt so the in-memory rows
// don't claim to have been persisted. Callers that care can detect it; most
// callers don't inspect these timestamps on FieldDefinitions anyway.
const EPOCH = new Date(0);

/** Stable synthetic identifier for a registry-sourced field or option. */
function inMemoryId(parts: string[]): string {
  return `in-memory:${parts.join(':')}`;
}

/** Mirror of the mapper in seed-entity-fields.ts — kept private to avoid exposing it. */
function mapDrizzleType(dataType: string): FieldType {
  switch (dataType) {
    case 'string': return 'text';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'date';
    default: return 'text';
  }
}

function toPicklistOption(
  entityType: string,
  fieldKey: string,
  opt: SetPicklistOptionInput,
  sortOrder: number,
): PicklistOption {
  return {
    id: inMemoryId([entityType, fieldKey, 'option', opt.value]),
    fieldId: inMemoryId([entityType, fieldKey]),
    label: opt.label,
    value: opt.value,
    isDefault: opt.isDefault ?? false,
    sortOrder,
  };
}

/**
 * Options that teach the in-memory builders about an `extensionOf` parent.
 * `parentConfig` is the parent entity's code definition; `projectedKeys` are
 * the fieldKeys that should be surfaced on the child. Both come from the
 * resolved extension metadata in `EntityRegistryService`.
 */
export interface InMemoryExtensionContext {
  parentConfig: EntityConfig;
  projectedKeys: string[];
}

/**
 * Produce the full set of `FullLayoutField` entries for an entity purely from
 * its in-memory `EntityConfig`. Mirrors the iteration order of
 * `seedEntityFields` — explicit `fieldMeta` entries first, then the implicit
 * system fields (`createdBy`, `createdAt`, `updatedAt`) when their columns
 * exist on the Drizzle table.
 *
 * IDs are synthesized deterministically as `in-memory:<entityType>:<fieldKey>`,
 * and the `createdAt`/`updatedAt` timestamps are the Unix epoch — both chosen
 * to make registry-sourced rows trivially distinguishable from rows that came
 * out of `field_definitions`.
 *
 * When `extension` is provided the parent's projected fields are appended
 * after the child's own fields. Projected keys that the child has already
 * re-declared in its own `fieldMeta` are skipped so child wins.
 */
export function buildInMemoryFields(
  config: EntityConfig,
  extension?: InMemoryExtensionContext,
): FullLayoutField[] {
  const columns = getTableColumns(config.table);
  const columnMap = new Map(Object.entries(columns));

  const skipSet = new Set<string>(['id', 'deletedAt', 'deletedBy']);
  for (const computed of config.computedColumns ?? []) skipSet.add(computed.name);

  const result: FullLayoutField[] = [];
  const seenKeys = new Set<string>();
  let fallbackSortOrder = 0;

  for (const [key, meta] of Object.entries(config.fieldMeta)) {
    if (skipSet.has(key)) continue;
    seenKeys.add(key);

    const col = columnMap.get(key) as { name?: string; notNull?: boolean; dataType?: string } | undefined;
    const fieldType: FieldType = meta.fieldType ?? (col ? mapDrizzleType(col.dataType ?? 'string') : 'text');

    const field: FieldDefinition = {
      id: inMemoryId([config.entityType, key]),
      entityType: config.entityType,
      fieldKey: key,
      label: meta.label,
      fieldType,
      uiType: meta.uiType ?? null,
      isRequired: col?.notNull ?? false,
      isSystem: meta.isSystem ?? false,
      isCustom: false,
      isUnique: meta.isUnique ?? false,
      isQuickCreate: meta.isQuickCreate ?? false,
      isReadonly: meta.isReadonly ?? false,
      maxLength: meta.maxLength ?? null,
      defaultValue: meta.defaultValue ?? null,
      columnName: col?.name ?? null,
      lookupEntity: meta.lookupEntity ?? null,
      lookupLabelField: meta.lookupLabelField ?? null,
      lookupSearchFields: meta.lookupSearchFields ?? null,
      tagGroupSlug: meta.tagGroupSlug ?? null,
      categoryGroupSlug: meta.categoryGroupSlug ?? null,
      fileAccept: meta.accept ?? null,
      fileMaxSize: meta.maxFileSize ?? null,
      sortOrder: meta.sortOrder ?? fallbackSortOrder++,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    };

    const picklistOptions = (meta.picklistOptions ?? []).map((opt, i) =>
      toPicklistOption(config.entityType, key, opt, i),
    );

    result.push({ ...field, picklistOptions, columnIndex: 0 });
  }

  const implicit: { key: string; label: string; fieldType: FieldType }[] = [
    { key: 'createdBy', label: 'Created By', fieldType: 'user' },
    { key: 'createdAt', label: 'Created At', fieldType: 'datetime' },
    { key: 'updatedAt', label: 'Updated At', fieldType: 'datetime' },
  ];

  for (const implicitField of implicit) {
    if (seenKeys.has(implicitField.key)) continue;
    const col = columnMap.get(implicitField.key) as { name?: string } | undefined;
    if (!col) continue;

    const field: FieldDefinition = {
      id: inMemoryId([config.entityType, implicitField.key]),
      entityType: config.entityType,
      fieldKey: implicitField.key,
      label: implicitField.label,
      fieldType: implicitField.fieldType,
      uiType: null,
      isRequired: false,
      isSystem: true,
      isCustom: false,
      isUnique: false,
      isQuickCreate: false,
      isReadonly: true,
      maxLength: null,
      defaultValue: null,
      columnName: col.name ?? null,
      lookupEntity: null,
      lookupLabelField: null,
      lookupSearchFields: null,
      tagGroupSlug: null,
      categoryGroupSlug: null,
      fileAccept: null,
      fileMaxSize: null,
      sortOrder: 9000 + result.length,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    };

    result.push({ ...field, picklistOptions: [], columnIndex: 0 });
  }

  if (extension) {
    const ownKeys = new Set(result.map((f) => f.fieldKey));
    const projected = new Set(extension.projectedKeys);
    const parentFields = buildInMemoryFields(extension.parentConfig);
    for (const parentField of parentFields) {
      if (!projected.has(parentField.fieldKey)) continue;
      if (ownKeys.has(parentField.fieldKey)) continue;
      result.push(parentField);
    }
  }

  return result;
}

/**
 * Produce a `FullLayout` for an entity purely from its in-memory
 * `EntityConfig`. Code-defined `config.sections` become layout sections;
 * fields in `fieldMeta` that aren't placed in any section fall into a virtual
 * "Unassigned Fields" section (system fields excluded, matching the DB-backed
 * `LayoutService.getLayout` behaviour). Fields marked `isQuickCreate` populate
 * `quickCreateFields`.
 *
 * When `extension` is provided the parent's projected fields appear in the
 * field set and can be placed in `config.sections` by fieldKey just like the
 * child's own fields. Projected fields that aren't placed land in "Unassigned
 * Fields" so the admin can slot them into sections later.
 */
export function buildInMemoryLayout(
  config: EntityConfig,
  layoutName = 'Standard',
  extension?: InMemoryExtensionContext,
): FullLayout {
  const fields = buildInMemoryFields(config, extension);
  const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const placedKeys = new Set<string>();

  const sections: FullLayoutSection[] = (config.sections ?? []).map((section, sIdx) => {
    const sectionFields: FullLayoutField[] = [];
    for (let fIdx = 0; fIdx < section.fields.length; fIdx++) {
      const entry = section.fields[fIdx];
      const fieldKey = Array.isArray(entry) ? entry[0] : entry;
      const columnIndex = Array.isArray(entry) ? entry[1] : fIdx % 2;
      const field = byKey.get(fieldKey);
      if (!field) continue;
      placedKeys.add(fieldKey);
      sectionFields.push({ ...field, columnIndex });
    }

    return {
      id: inMemoryId([config.entityType, 'section', String(sIdx)]),
      name: section.name,
      columns: section.columns ?? 2,
      sortOrder: sIdx,
      isCollapsible: section.isCollapsible ?? true,
      isTabular: section.isTabular ?? false,
      tabularMaxRows: section.tabularMaxRows ?? null,
      fields: sectionFields,
    };
  });

  const unassignedFields = fields
    .filter((f) => !placedKeys.has(f.fieldKey) && !f.isSystem)
    .map((f) => ({ ...f, columnIndex: 0 }));

  if (unassignedFields.length > 0) {
    sections.push({
      id: '__unassigned__',
      name: 'Unassigned Fields',
      columns: 2,
      sortOrder: 999,
      isCollapsible: true,
      isTabular: false,
      tabularMaxRows: null,
      fields: unassignedFields,
    });
  }

  const quickCreateFields = fields.filter((f) => f.isQuickCreate).map((f) => ({ ...f, columnIndex: 0 }));

  return {
    entityType: config.entityType,
    layoutName,
    sections,
    quickCreateFields,
  };
}
