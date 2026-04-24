import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManifestRegistry, type PermissionManifest } from '../permission-manifest';

function manifest(overrides: Partial<PermissionManifest> = {}): PermissionManifest {
  return {
    slug: 'filings.pickup',
    module: 'filings',
    action: 'pickup',
    label: 'Pick up filing',
    supportedScopes: ['unit', 'unassigned_in_unit'],
    ...overrides,
  };
}

describe('PermissionManifestRegistry', () => {
  let registry: PermissionManifestRegistry;

  beforeEach(() => {
    registry = new PermissionManifestRegistry();
  });

  it('registers and retrieves a manifest by slug', () => {
    const m = manifest();
    registry.register(m);
    expect(registry.get('filings.pickup')).toEqual(m);
    expect(registry.has('filings.pickup')).toBe(true);
  });

  it('returns undefined for unknown slug', () => {
    expect(registry.get('unknown.perm')).toBeUndefined();
    expect(registry.has('unknown.perm')).toBe(false);
  });

  it('throws when registering a duplicate slug', () => {
    registry.register(manifest());
    expect(() => registry.register(manifest({ label: 'Different' }))).toThrow(
      "Permission manifest 'filings.pickup' is already registered",
    );
  });

  it('throws when a manifest declares empty supportedScopes', () => {
    expect(() => registry.register(manifest({ supportedScopes: [] }))).toThrow(
      "must declare at least one supportedScope",
    );
  });

  it('registerMany adds all manifests', () => {
    registry.registerMany([
      manifest({ slug: 'a.x', module: 'a', action: 'x' }),
      manifest({ slug: 'b.y', module: 'b', action: 'y' }),
    ]);
    expect(registry.list()).toHaveLength(2);
  });

  it('registerMany is not atomic — earlier registrations persist on later failure', () => {
    registry.register(manifest({ slug: 'a.x', module: 'a', action: 'x' }));
    expect(() =>
      registry.registerMany([
        manifest({ slug: 'b.y', module: 'b', action: 'y' }),
        manifest({ slug: 'a.x', module: 'a', action: 'x' }),
      ]),
    ).toThrow();
    // The first of the batch (b.y) should have landed before the duplicate threw.
    expect(registry.has('b.y')).toBe(true);
  });

  it('list returns every registered manifest', () => {
    registry.registerMany([
      manifest({ slug: 'a.x', module: 'a', action: 'x' }),
      manifest({ slug: 'b.y', module: 'b', action: 'y' }),
    ]);
    const slugs = registry.list().map((m) => m.slug).sort();
    expect(slugs).toEqual(['a.x', 'b.y']);
  });

  it('listByModule filters to the requested module', () => {
    registry.registerMany([
      manifest({ slug: 'filings.read', module: 'filings', action: 'read', supportedScopes: ['any'] }),
      manifest({ slug: 'filings.pickup', module: 'filings', action: 'pickup' }),
      manifest({ slug: 'reports.read', module: 'reports', action: 'read', supportedScopes: ['any'] }),
    ]);
    const filings = registry.listByModule('filings').map((m) => m.action).sort();
    expect(filings).toEqual(['pickup', 'read']);
  });

  it('getSupportedScopes returns declared scope types', () => {
    registry.register(manifest({ supportedScopes: ['unit', 'own'] }));
    expect(registry.getSupportedScopes('filings.pickup')).toEqual(['unit', 'own']);
  });

  it('getSupportedScopes returns undefined for unknown slug', () => {
    expect(registry.getSupportedScopes('nope.read')).toBeUndefined();
  });
});
