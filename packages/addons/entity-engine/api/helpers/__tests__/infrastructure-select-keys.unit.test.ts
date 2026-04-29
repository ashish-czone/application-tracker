import { describe, it, expect } from 'vitest';
import { infrastructureSelectKeys } from '../infrastructure-select-keys';

describe('infrastructureSelectKeys', () => {
  it('returns no keys for a flat entity (no hierarchy, no orderable)', () => {
    expect(infrastructureSelectKeys({})).toEqual([]);
  });

  it('returns hierarchy columns when hierarchy is enabled', () => {
    expect(infrastructureSelectKeys({ hierarchy: true })).toEqual(['parentId', 'path', 'depth']);
  });

  it('returns sortOrder when orderable is enabled', () => {
    expect(infrastructureSelectKeys({ orderable: true })).toEqual(['sortOrder']);
  });

  it('returns all four columns when both flags are enabled', () => {
    expect(infrastructureSelectKeys({ hierarchy: true, orderable: true })).toEqual([
      'parentId',
      'path',
      'depth',
      'sortOrder',
    ]);
  });

  it('treats false/undefined flags identically', () => {
    expect(infrastructureSelectKeys({ hierarchy: false, orderable: false })).toEqual([]);
  });
});
