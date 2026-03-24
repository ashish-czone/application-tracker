import { getTableColumns } from 'drizzle-orm';
import type { FieldDefinitionService, LayoutService, FieldType, RegisterFieldInput } from '@packages/eav-attributes';
import type { EntityConfig } from './types';

/** Map Drizzle column dataType to EAV FieldType. */
function mapDrizzleType(dataType: string): FieldType {
  switch (dataType) {
    case 'string': return 'text';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'date';
    default: return 'text';
  }
}

/**
 * Seeds field definitions, picklist options, and default layout for an entity.
 *
 * Only registers fields that are in `fieldMeta`. DB columns not in fieldMeta
 * are ignored (they're internal/legacy columns not shown to users).
 *
 * Fields in `fieldMeta` that have a matching Drizzle column get `columnName` set.
 * Fields in `fieldMeta` without a matching column are registered as virtual/EAV fields
 * (rich_text, tags, file, category, multi_user, multi_lookup, or custom EAV fields).
 *
 * This is idempotent — safe to call on every app startup.
 */
export async function seedEntityFields(
  config: EntityConfig,
  fieldDefinitionService: FieldDefinitionService,
  layoutService: LayoutService,
): Promise<void> {
  const skipSet = new Set(config.systemColumns);
  const columns = getTableColumns(config.table);
  const columnMap = new Map(Object.entries(columns));

  const fields: RegisterFieldInput[] = [];

  for (const [key, meta] of Object.entries(config.fieldMeta)) {
    if (skipSet.has(key)) continue;

    const col = columnMap.get(key);

    fields.push({
      fieldKey: key,
      label: meta.label,
      fieldType: meta.fieldType ?? (col ? mapDrizzleType(col.dataType) : 'text'),
      columnName: col?.name ?? undefined, // undefined for virtual/EAV-only fields
      isRequired: col?.notNull ?? false,
      isSystem: meta.isSystem ?? false,
      isUnique: meta.isUnique ?? false,
      isQuickCreate: meta.isQuickCreate ?? false,
      isReadonly: meta.isReadonly ?? false,
      maxLength: meta.maxLength ?? undefined,
      defaultValue: meta.defaultValue ?? undefined,
      uiType: meta.uiType ?? undefined,
      lookupEntity: meta.lookupEntity ?? undefined,
      lookupLabelField: meta.lookupLabelField ?? undefined,
      lookupSearchFields: meta.lookupSearchFields ?? undefined,
      tagGroupSlug: meta.tagGroupSlug ?? undefined,
      categoryGroupSlug: meta.categoryGroupSlug ?? undefined,
      fileAccept: meta.accept ?? undefined,
      fileMaxSize: meta.maxFileSize ?? undefined,
      sortOrder: meta.sortOrder,
    });
  }

  // Register all fields (idempotent upsert)
  await fieldDefinitionService.registerStandardFields(config.entityType, fields);

  // Set picklist options for fields that have them
  for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
    if (meta.picklistOptions && meta.picklistOptions.length > 0) {
      await fieldDefinitionService.setPicklistOptions(
        config.entityType,
        fieldKey,
        meta.picklistOptions.map((opt, i) => ({
          label: opt.label,
          value: opt.value,
          isDefault: opt.isDefault,
          sortOrder: i,
        })),
      );
    }
  }

  // Seed default layout sections
  if (config.sections.length > 0) {
    await layoutService.seedDefaultLayout(config.entityType, config.sections);
  }
}
