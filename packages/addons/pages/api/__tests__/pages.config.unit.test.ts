import { describe, it, expect } from 'vitest';
import { PAGES_CONFIG } from '../pages.config';

describe('PAGES_CONFIG', () => {
  it('declares the expected entity shape', () => {
    expect(PAGES_CONFIG.entityType).toBe('pages');
    expect(PAGES_CONFIG.singularName).toBe('Page');
    expect(PAGES_CONFIG.pluralName).toBe('Pages');
    expect(PAGES_CONFIG.onDelete.mode).toBe('soft');
    expect(PAGES_CONFIG.defaultSort).toBe('createdAt');
  });

  it('marks title as the label field and required', () => {
    expect(PAGES_CONFIG.ui.nameField).toBe('title');
    expect(PAGES_CONFIG.fieldMeta.title).toBeDefined();
    expect(PAGES_CONFIG.fieldMeta.title.fieldType).toBe('text');
  });

  it('marks slug as unique and required', () => {
    expect(PAGES_CONFIG.fieldMeta.slug).toBeDefined();
    expect(PAGES_CONFIG.fieldMeta.slug.isUnique).toBe(true);
  });

  it('has no custom-fields column (fixed schema only)', () => {
    expect(PAGES_CONFIG.customFields).toBeFalsy();
  });

  it('does not mark SEO fields as list-visible (clutter-free list)', () => {
    expect(PAGES_CONFIG.listFields).toContain('title');
    expect(PAGES_CONFIG.listFields).toContain('slug');
    expect(PAGES_CONFIG.listFields).not.toContain('metaDescription');
    expect(PAGES_CONFIG.listFields).not.toContain('ogImage');
  });

  it('marks title and slug as quick-create fields', () => {
    expect(PAGES_CONFIG.fieldMeta.title.isQuickCreate).toBe(true);
    expect(PAGES_CONFIG.fieldMeta.slug.isQuickCreate).toBe(true);
    expect(PAGES_CONFIG.fieldMeta.metaDescription.isQuickCreate).toBeFalsy();
    expect(PAGES_CONFIG.fieldMeta.ogImage.isQuickCreate).toBeFalsy();
  });

  it('routes the quick-create success into the page editor', () => {
    expect(PAGES_CONFIG.ui.afterCreateRoute).toBe('/pages/:id/edit');
  });
});
