import { getTableColumns } from 'drizzle-orm';
import type { FieldDefinitionService, LayoutService, FieldType } from '@packages/eav-attributes';
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

  const fields = Object.entries(columns)
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
        sortOrder: meta?.sortOrder ?? index,
      };
    });

  // Register all standard fields (idempotent upsert)
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
