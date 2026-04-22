/**
 * Field types contributed by the media-library addon.
 *
 * - `media` — stores a UUID reference to a `media_assets` row. Stored in
 *   the EAV `valueText` column (same as other reference types) so existing
 *   entities can opt-in via `customFields: true` or EAV. Rendered in the
 *   UI as a thumbnail + picker that reuses the library gallery.
 */
import { defineFieldType, validators } from '@packages/field-types';
import type { FieldTypePlugin } from '@packages/field-types';

const media = defineFieldType({
  type: 'media',
  label: 'Media',
  family: 'reference',
  icon: 'Image',
  color: 'bg-violet-100 text-violet-800',
  sortOrder: 22,
  validate: validators.uuid,
  filterOperators: ['eq', 'neq', 'isNull', 'isNotNull'],
  sortable: false,
  excludeFromList: true,
});

export const mediaLibraryFieldTypesPlugin: FieldTypePlugin = {
  name: 'media-library',
  fieldTypes: [media],
};
