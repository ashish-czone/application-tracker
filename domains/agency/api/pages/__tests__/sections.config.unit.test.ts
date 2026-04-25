import { describe, it, expect } from 'vitest';
import { SECTIONS_CONFIG } from '../sections.config';

describe('SECTIONS_CONFIG', () => {
  it('declares the expected entity shape', () => {
    expect(SECTIONS_CONFIG.entityType).toBe('sections');
    expect(SECTIONS_CONFIG.onDelete.mode).toBe('hard');
    expect(SECTIONS_CONFIG.defaultSort).toBe('order');
  });

  it('opts into JSONB custom-fields storage', () => {
    expect(SECTIONS_CONFIG.customFields).toBe(true);
  });

  it('registers pageId as a lookup to pages', () => {
    const pageIdMeta = SECTIONS_CONFIG.fieldMeta.pageId;
    expect(pageIdMeta).toBeDefined();
    expect(pageIdMeta.fieldType).toBe('lookup');
    expect(pageIdMeta.lookupEntity).toBe('pages');
  });

  it('marks blockKind and variant as system fields (not admin-editable via generic form)', () => {
    expect(SECTIONS_CONFIG.fieldMeta.blockKind.isSystem).toBe(true);
    expect(SECTIONS_CONFIG.fieldMeta.variant.isSystem).toBe(true);
  });

  it('declares customFields column as a system column', () => {
    expect(SECTIONS_CONFIG.systemColumns).toContain('customFields');
  });

  it('exposes title as an admin-editable text field (used as section heading)', () => {
    const titleMeta = SECTIONS_CONFIG.fieldMeta.title;
    expect(titleMeta).toBeDefined();
    expect(titleMeta.fieldType).toBe('text');
    expect(titleMeta.isSystem ?? false).toBe(false);
  });

  it('declares dataSource as a data_source field (system, not in generic forms)', () => {
    const dsMeta = SECTIONS_CONFIG.fieldMeta.dataSource;
    expect(dsMeta).toBeDefined();
    expect(dsMeta.fieldType).toBe('data_source');
    expect(dsMeta.isSystem).toBe(true);
  });
});
