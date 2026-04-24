import { describe, expect, it } from 'vitest';
import { ORGANIZATIONS_CONFIG } from '../organizations.config';

describe('ORGANIZATIONS_CONFIG', () => {
  it('is registered under the hyphenated-plural slug', () => {
    expect(ORGANIZATIONS_CONFIG.slug).toBe('organizations');
  });

  it('registers the logo field as a file field type', () => {
    expect(ORGANIZATIONS_CONFIG.fieldMeta.logoUrl.fieldType).toBe('file');
  });

  it('exposes the name field as the entity label', () => {
    expect(ORGANIZATIONS_CONFIG.lookup?.labelField).toBe('name');
  });

  it('uses onDelete: restrict so engine-level deletes are rejected', () => {
    expect(ORGANIZATIONS_CONFIG.onDelete.mode).toBe('restrict');
  });
});
