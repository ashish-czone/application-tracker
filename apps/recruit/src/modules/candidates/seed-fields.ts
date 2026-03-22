import { getTableColumns } from 'drizzle-orm';
import { candidates } from './schema/candidates';
import { CANDIDATE_FIELD_META, SKIP_FIELDS, CANDIDATE_SECTIONS } from './field-meta';
import type { FieldDefinitionService, LayoutService, FieldType } from '@packages/eav-attributes';

/** Map Drizzle column dataType to EAV FieldType */
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
 * Seeds candidate field definitions, picklist options, and default layout.
 * Derives field list from the Drizzle schema and merges with presentation metadata.
 *
 * This is idempotent — safe to call on every seed run.
 */
export async function seedCandidateFields(
  fieldDefinitionService: FieldDefinitionService,
  layoutService: LayoutService,
): Promise<void> {
  const columns = getTableColumns(candidates);

  const fields = Object.entries(columns)
    .filter(([key]) => !SKIP_FIELDS.includes(key))
    .map(([key, col], index) => {
      const meta = CANDIDATE_FIELD_META[key];
      return {
        fieldKey: key, // camelCase Drizzle property name — matches API payload keys
        label: meta?.label ?? key,
        fieldType: meta?.fieldType ?? mapDrizzleType(col.dataType),
        columnName: col.name,
        isRequired: col.notNull ?? false,
        isSystem: meta?.isSystem ?? false,
        isUnique: meta?.isUnique ?? false,
        isQuickCreate: meta?.isQuickCreate ?? false,
        maxLength: meta?.maxLength ?? undefined,
        sortOrder: meta?.sortOrder ?? index,
      };
    });

  // Register all standard fields (idempotent upsert)
  await fieldDefinitionService.registerStandardFields('candidates', fields);

  // Set picklist options for fields that have them
  for (const [, meta] of Object.entries(CANDIDATE_FIELD_META)) {
    if (meta.picklistOptions) {
      // Find the matching field entry to get its fieldKey (camelCase)
      const fieldEntry = fields.find(f => f.label === meta.label);
      if (fieldEntry) {
        await fieldDefinitionService.setPicklistOptions(
          'candidates',
          fieldEntry.fieldKey,
          meta.picklistOptions.map((opt, i) => ({
            label: opt.label,
            value: opt.value,
            sortOrder: i,
          })),
        );
      }
    }
  }

  // Seed default layout
  await layoutService.seedDefaultLayout('candidates', CANDIDATE_SECTIONS);
}
