import {
  buildFormSchema as buildFormSchemaFromFieldDefinitions,
  type FieldDefinition,
} from '@packages/eav-attributes-ui';
import type { z } from 'zod';
import type { FormFieldDefinition } from '../define-form-layout';

/**
 * Adapt a slim `FormFieldDefinition` to the full `FieldDefinition` shape
 * `@packages/eav-attributes-ui`'s `buildFormSchema` and `DynamicField`
 * consume. Server-derived properties (`id`, `entityType`, `columnIndex`,
 * `sortOrder`, `isCustom`, etc.) are stamped with safe defaults — they
 * have no semantic effect on form rendering.
 *
 * Exported for tests and consumers that need to render an individual
 * `FormFieldDefinition` without going through `<EntityFormFields>`.
 */
export function adaptFormFieldDefinition(
  field: FormFieldDefinition,
  entityType: string,
  sortOrder: number,
): FieldDefinition {
  return {
    id: `form:${entityType}:${field.fieldKey}`,
    entityType,
    fieldKey: field.fieldKey,
    label: field.label,
    fieldType: field.fieldType,
    uiType: field.uiType ?? null,
    isRequired: field.isRequired ?? false,
    isSystem: false,
    isCustom: false,
    isUnique: false,
    isQuickCreate: false,
    isReadonly: field.isReadonly ?? false,
    maxLength: field.maxLength ?? null,
    defaultValue: field.defaultValue ?? null,
    columnName: field.fieldKey,
    lookupEntity: field.lookupEntity ?? null,
    lookupLabelField: null,
    lookupSearchFields: null,
    tagGroupSlug: field.tagGroupSlug ?? null,
    categoryGroupSlug: field.categoryGroupSlug ?? null,
    fileAccept: field.fileAccept ?? null,
    fileMaxSize: field.fileMaxSize ?? null,
    sortOrder,
    picklistOptions: (field.picklistOptions ?? []).map((o, i) => ({
      id: `form:${entityType}:${field.fieldKey}:${o.value}`,
      fieldId: `form:${entityType}:${field.fieldKey}`,
      label: o.label,
      value: o.value,
      isDefault: false,
      sortOrder: i,
    })),
    columnIndex: 0,
    nestedPath: null,
  };
}

/**
 * Build a Zod schema from a list of `FormFieldDefinition`s. Thin wrapper
 * over `@packages/eav-attributes-ui/buildFormSchema` that handles the
 * shape adaptation.
 */
export function buildFormSchema(
  fields: FormFieldDefinition[],
  entityType = 'unknown',
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const adapted = fields.map((f, i) => adaptFormFieldDefinition(f, entityType, i));
  return buildFormSchemaFromFieldDefinitions(adapted);
}
