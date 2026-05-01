import { describe, expect, it } from 'vitest';
import { crudPermissionManifests } from '../crud-permission-manifests';

describe('crudPermissionManifests', () => {
  it('produces the 4 standard CRUD manifests with module-prefixed slugs', () => {
    const result = crudPermissionManifests({ module: 'compliance-rules', entityName: 'rule' });
    expect(result).toHaveLength(4);
    expect(result.map((m) => m.slug)).toEqual([
      'compliance-rules.read',
      'compliance-rules.create',
      'compliance-rules.update',
      'compliance-rules.delete',
    ]);
    expect(result.every((m) => m.module === 'compliance-rules')).toBe(true);
  });

  it('uses entity plural in labels (auto-derived as entityName + "s")', () => {
    const [read] = crudPermissionManifests({ module: 'rules', entityName: 'rule' });
    expect(read.label).toBe('View rules');
    expect(read.description).toBe('View rules');
  });

  it('respects an explicit entityPlural override (irregular plurals)', () => {
    const [read] = crudPermissionManifests({
      module: 'taxonomies',
      entityName: 'taxonomy',
      entityPlural: 'taxonomies',
    });
    expect(read.label).toBe('View taxonomies');
  });

  it('defaults supportedScopes to ["any"]', () => {
    const [read] = crudPermissionManifests({ module: 'rules', entityName: 'rule' });
    expect(read.supportedScopes).toEqual(['any']);
  });

  it('respects custom supportedScopes', () => {
    const result = crudPermissionManifests({
      module: 'filings',
      entityName: 'filing',
      supportedScopes: ['any', 'assigned', 'team'],
    });
    expect(result[0].supportedScopes).toEqual(['any', 'assigned', 'team']);
    expect(result.every((m) => m.supportedScopes.length === 3)).toBe(true);
  });

  it('action field matches the standard CRUD verbs', () => {
    const result = crudPermissionManifests({ module: 'x', entityName: 'x' });
    expect(result.map((m) => m.action)).toEqual(['read', 'create', 'update', 'delete']);
  });
});
