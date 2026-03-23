import { getTableColumns } from 'drizzle-orm';
import type { FieldDefinitionService, LayoutService, FieldType, RegisterFieldInput } from '@packages/eav-attributes';
import { RELATIONAL_FIELD_TYPES } from '@packages/eav-attributes';
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
 * Derives the field list from the Drizzle table schema and merges with fieldMeta.
 * Virtual fields (tags, file, category) defined only in fieldMeta are also registered.
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

  // Standard fields derived from Drizzle schema
  const fields: RegisterFieldInput[] = Object.entries(columns)
    .filter(([key]) => !skipSet.has(key))
    .map(([key, col], index) => {
      const meta = config.fieldMeta[key];
      return {
        fieldKey: key,
        label: meta?.label ?? key,
        fieldType: meta?.fieldType ?? mapDrizzleType(col.dataType),
        columnName: col.name,
        isRequired: col.notNull ?? false,
        isSystem: meta?.isSystem ?? false,
        isUnique: meta?.isUnique ?? false,
        isQuickCreate: meta?.isQuickCreate ?? false,
        isReadonly: meta?.isReadonly ?? false,
        maxLength: meta?.maxLength ?? undefined,
        defaultValue: meta?.defaultValue ?? undefined,
        uiType: meta?.uiType ?? undefined,
        lookupEntity: meta?.lookupEntity ?? undefined,
        lookupLabelField: meta?.lookupLabelField ?? undefined,
        lookupSearchFields: meta?.lookupSearchFields ?? undefined,
        tagGroupSlug: meta?.tagGroupSlug ?? undefined,
        categoryGroupSlug: meta?.categoryGroupSlug ?? undefined,
        fileAccept: meta?.accept ?? undefined,
        fileMaxSize: meta?.maxFileSize ?? undefined,
        sortOrder: meta?.sortOrder ?? index,
      };
    });

  // Virtual fields from fieldMeta that don't have DB columns (tags, file, category without a column)
  const registeredKeys = new Set(fields.map(f => f.fieldKey));
  for (const [key, meta] of Object.entries(config.fieldMeta)) {
    if (registeredKeys.has(key) || skipSet.has(key)) continue;
    if (!meta.fieldType || !RELATIONAL_FIELD_TYPES.has(meta.fieldType)) continue;

    fields.push({
      fieldKey: key,
      label: meta.label,
      fieldType: meta.fieldType,
      // No columnName — these are virtual/relational fields
      isSystem: meta.isSystem ?? false,
      isQuickCreate: meta.isQuickCreate ?? false,
      isReadonly: meta.isReadonly ?? false,
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
