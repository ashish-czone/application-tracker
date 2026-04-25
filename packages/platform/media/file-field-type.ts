import { defineFieldType } from '@packages/field-types';
import type { FieldTypeDefinition, FieldTypePlugin } from '@packages/field-types';
import type { MediaService } from './services/media.service';
import type { MediaFile } from './types';

function isMediaFile(value: unknown): value is MediaFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string' &&
    typeof (value as { originalName?: unknown }).originalName === 'string'
  );
}

/**
 * Builds the `file` field type definition with media-aware save behavior.
 * The `transformValueBeforeSave` hook moves uploads from `tmp/` to the
 * entity's permanent storage location once the entity id is known.
 */
export function createFileFieldType(media: MediaService): FieldTypeDefinition {
  return defineFieldType({
    type: 'file',
    label: 'File',
    family: 'special',
    icon: 'Paperclip',
    color: 'bg-gray-100 text-gray-800',
    sortOrder: 20,
    creatable: true,
    excludeFromList: true,
    transformValueBeforeSave: async (value, ctx) => {
      if (isMediaFile(value) && value.key.startsWith('tmp/')) {
        return media.moveFromTmp(value, ctx.entityType, ctx.entityId, ctx.fieldKey);
      }
      return value;
    },
  });
}

export function createMediaFieldTypesPlugin(media: MediaService): FieldTypePlugin {
  return {
    name: 'media',
    fieldTypes: [createFileFieldType(media)],
  };
}
