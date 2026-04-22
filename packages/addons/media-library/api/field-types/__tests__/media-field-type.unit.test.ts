import { describe, it, expect } from 'vitest';
import { FieldTypeRegistry } from '@packages/field-types';
import { mediaLibraryFieldTypesPlugin } from '../index';

describe('mediaLibraryFieldTypesPlugin', () => {
  it('registers a single "media" field type', () => {
    expect(mediaLibraryFieldTypesPlugin.name).toBe('media-library');
    expect(mediaLibraryFieldTypesPlugin.fieldTypes).toHaveLength(1);
    expect(mediaLibraryFieldTypesPlugin.fieldTypes[0].type).toBe('media');
  });

  it('stores its value in valueText (reference family default)', () => {
    const registry = new FieldTypeRegistry();
    registry.registerPlugin(mediaLibraryFieldTypesPlugin);
    const media = registry.getOrThrow('media');
    expect(media.storage).toEqual({ type: 'eav', column: 'valueText' });
  });

  it('exposes reference-family filter operators', () => {
    const registry = new FieldTypeRegistry();
    registry.registerPlugin(mediaLibraryFieldTypesPlugin);
    const media = registry.getOrThrow('media');
    expect(media.filterOperators).toEqual(['eq', 'neq', 'isNull', 'isNotNull']);
  });

  it('rejects non-UUID values via the validator', () => {
    const registry = new FieldTypeRegistry();
    registry.registerPlugin(mediaLibraryFieldTypesPlugin);
    const media = registry.getOrThrow('media');
    const ctx = { fieldKey: 'logo', fieldType: 'media', label: 'Logo', isRequired: false };
    const goodUuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(media.validate(goodUuid, ctx)).toBeNull();
    const bad = media.validate('not-a-uuid', ctx);
    expect(bad).not.toBeNull();
  });

  it('is flagged as a reference type', () => {
    const registry = new FieldTypeRegistry();
    registry.registerPlugin(mediaLibraryFieldTypesPlugin);
    const media = registry.getOrThrow('media');
    expect(media.family).toBe('reference');
    expect(media.isReference).toBe(true);
  });
});
