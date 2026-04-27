import { describe, it, expect } from 'vitest';
import { buildEntityUIIndex } from '../helpers/buildEntityUIIndex';
import type { EntityUIConfig } from '../types';

describe('buildEntityUIIndex', () => {
  it('returns empty maps when given no configs', () => {
    const idx = buildEntityUIIndex([]);
    expect(idx.presentation.size).toBe(0);
    expect(idx.fieldUI.size).toBe(0);
    expect(idx.actionUI.size).toBe(0);
  });

  it('indexes presentation per entity type', () => {
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'users', navGroup: 'recruit', navOrder: 1 } },
      { entityType: 'jobs', presentation: { icon: 'briefcase', navGroup: 'recruit', navOrder: 2 } },
    ];
    const idx = buildEntityUIIndex(configs);
    expect(idx.presentation.get('candidates')).toEqual({ icon: 'users', navGroup: 'recruit', navOrder: 1 });
    expect(idx.presentation.get('jobs')?.icon).toBe('briefcase');
    expect(idx.presentation.get('unknown')).toBeUndefined();
  });

  it('indexes per-field UI overrides keyed by field key', () => {
    const configs: EntityUIConfig[] = [
      {
        entityType: 'candidates',
        fieldUI: {
          fullName: { cellRenderer: 'AvatarNameCell' },
          stage: { uiType: 'pill' },
        },
      },
    ];
    const idx = buildEntityUIIndex(configs);
    expect(idx.fieldUI.get('candidates')?.get('fullName')).toEqual({ cellRenderer: 'AvatarNameCell' });
    expect(idx.fieldUI.get('candidates')?.get('stage')).toEqual({ uiType: 'pill' });
    expect(idx.fieldUI.get('candidates')?.get('missing')).toBeUndefined();
  });

  it('indexes per-action UI overrides keyed by action key', () => {
    const configs: EntityUIConfig[] = [
      {
        entityType: 'candidates',
        actionUI: {
          edit: { label: 'Edit', icon: 'Pencil' },
          delete: { label: 'Delete', icon: 'Trash2', variant: 'destructive' },
        },
      },
    ];
    const idx = buildEntityUIIndex(configs);
    expect(idx.actionUI.get('candidates')?.get('edit')).toEqual({ label: 'Edit', icon: 'Pencil' });
    expect(idx.actionUI.get('candidates')?.get('delete')?.variant).toBe('destructive');
  });

  it('omits entries when a config has no presentation/fieldUI/actionUI', () => {
    const configs: EntityUIConfig[] = [{ entityType: 'candidates' }];
    const idx = buildEntityUIIndex(configs);
    expect(idx.presentation.has('candidates')).toBe(false);
    expect(idx.fieldUI.has('candidates')).toBe(false);
    expect(idx.actionUI.has('candidates')).toBe(false);
  });

  it('handles multiple entities with mixed shapes', () => {
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'users' }, fieldUI: { name: { cellRenderer: 'X' } } },
      { entityType: 'jobs', actionUI: { archive: { label: 'Archive' } } },
      { entityType: 'orders' },
    ];
    const idx = buildEntityUIIndex(configs);
    expect(idx.presentation.get('candidates')?.icon).toBe('users');
    expect(idx.fieldUI.get('candidates')?.get('name')?.cellRenderer).toBe('X');
    expect(idx.actionUI.get('jobs')?.get('archive')?.label).toBe('Archive');
    expect(idx.presentation.has('orders')).toBe(false);
  });
});
