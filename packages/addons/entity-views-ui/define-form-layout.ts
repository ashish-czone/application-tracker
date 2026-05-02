import type { FieldType } from '@packages/eav-attributes-ui';

/**
 * Slim form-field definition. Mirrors the rendering-relevant subset of
 * `@packages/eav-attributes-ui`'s `FieldDefinition` — we only carry the
 * properties `DynamicField` actually reads, plus the validation hints
 * `buildFormSchema` needs. Server-side metadata (id, columnIndex,
 * sortOrder, isCustom, isSystem, etc.) is omitted; the renderer fills
 * sensible defaults when adapting to the full shape.
 */
export interface FormFieldDefinition {
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  isRequired?: boolean;
  isReadonly?: boolean;
  /** Custom widget hint (e.g. `'color-picker'`). Falls through to the field-type registry's default `FormComponent` when omitted. */
  uiType?: string;
  /** Max length for text-shaped fields. Applied by `buildFormSchema`. */
  maxLength?: number;
  /** Default seeded into the form when no row value exists. */
  defaultValue?: string;
  /** Lookup target entity (for `lookup` / `multi_lookup`). */
  lookupEntity?: string;
  /** Tag group slug (for `tags`). */
  tagGroupSlug?: string;
  /** Category group slug (for `category`). */
  categoryGroupSlug?: string;
  /** Accepted MIME types (for `file`). */
  fileAccept?: string[];
  /** Max file size in bytes (for `file`). */
  fileMaxSize?: number;
  /** Picklist options (for `picklist` / `multi_select`). */
  picklistOptions?: { label: string; value: string }[];
}

/**
 * A single section in the form layout. Mirrors `LayoutSection` from
 * `@packages/eav-attributes-ui` but slimmer — `id`, `sortOrder`,
 * `isCollapsible`, `isTabular` are renderer-default unless declared.
 */
export interface FormSectionDefinition {
  /** Stable identifier. Defaults to a normalised version of `name` if omitted. */
  id?: string;
  /** Display name (section header). */
  name: string;
  /** Number of columns the renderer lays the fields into (1 or 2). Default: 2. */
  columns?: 1 | 2;
  /** Fields rendered in this section, in the order they should appear. */
  fields: FormFieldDefinition[];
}

/**
 * Static form layout for an entity. Pages consume this via
 * `<EntityFormFields layout={...}>`. Replaces the server-fetched
 * `useEntityLayout` for entities that have a fixed, code-defined form.
 */
export interface FormLayoutDefinition {
  /** Entity slug — informational; used for query keys + section ids when omitted. */
  entity: string;
  sections: FormSectionDefinition[];
}

/**
 * Identity factory — returns the layout unchanged but anchors the type
 * inference and provides a single import surface for entity configs.
 *
 * @example
 *   export const ORGANIZATIONS_FORM_LAYOUT = defineFormLayout({
 *     entity: 'organizations',
 *     sections: [
 *       { name: 'Organization', columns: 2, fields: [
 *         { fieldKey: 'name', label: 'Name', fieldType: 'text', isRequired: true },
 *         { fieldKey: 'email', label: 'Email', fieldType: 'email' },
 *         ...
 *       ]},
 *     ],
 *   });
 */
export function defineFormLayout(definition: FormLayoutDefinition): FormLayoutDefinition {
  return definition;
}

/**
 * Flatten every editable field across sections, in render order. Used by
 * `buildFormSchema` to derive the Zod schema and by consumers that need
 * the field list independent of section structure (e.g. for default-value
 * seeding).
 */
export function flattenFormFields(layout: FormLayoutDefinition): FormFieldDefinition[] {
  return layout.sections.flatMap((s) => s.fields).filter((f) => !f.isReadonly);
}
