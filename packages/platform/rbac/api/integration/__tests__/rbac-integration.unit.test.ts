import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModuleRef } from '@nestjs/core';
import { RbacFeatureRegistrations } from '../rbac-integration.module';
import { PermissionManifestRegistry, type PermissionManifest } from '../../permission-manifest';
import { ScopeResolverRegistry, type ScopeResolver } from '../../scope-resolver';
import { RbacService } from '../../services/rbac.service';

function manifest(overrides: Partial<PermissionManifest> = {}): PermissionManifest {
  return {
    slug: 'foo.read',
    module: 'foo',
    action: 'read',
    label: 'Read foo',
    supportedScopes: ['any'],
    ...overrides,
  };
}

class FakeResolver implements ScopeResolver {
  readonly type: string;
  constructor(type: string) {
    this.type = type;
  }
  resolve() {
    return undefined;
  }
}

function createDeps() {
  const manifestRegistry = new PermissionManifestRegistry();
  const scopeResolverRegistry = new ScopeResolverRegistry();
  // RbacService.registerManifests just delegates to manifestRegistry.registerMany.
  // Stub the rest of the service surface — none of it is exercised here.
  const rbacService = {
    registerManifests: (m: PermissionManifest[]) => manifestRegistry.registerMany(m),
  } as unknown as RbacService;
  return { manifestRegistry, scopeResolverRegistry, rbacService };
}

describe('RbacFeatureRegistrations', () => {
  let manifestRegistry: PermissionManifestRegistry;
  let scopeResolverRegistry: ScopeResolverRegistry;
  let rbacService: RbacService;
  let moduleRef: ModuleRef;

  beforeEach(() => {
    ({ manifestRegistry, scopeResolverRegistry, rbacService } = createDeps());
    moduleRef = { get: vi.fn() } as unknown as ModuleRef;
  });

  it('registers manifests via RbacService when config.manifests is provided', () => {
    const registrations = new RbacFeatureRegistrations(
      { manifests: [manifest({ slug: 'foo.read' }), manifest({ slug: 'foo.write', action: 'write' })] },
      rbacService,
      scopeResolverRegistry,
      moduleRef,
    );

    registrations.onModuleInit();

    expect(manifestRegistry.has('foo.read')).toBe(true);
    expect(manifestRegistry.has('foo.write')).toBe(true);
    expect(manifestRegistry.list()).toHaveLength(2);
  });

  it('skips manifest registration when config.manifests is empty or absent', () => {
    new RbacFeatureRegistrations(
      {},
      rbacService,
      scopeResolverRegistry,
      moduleRef,
    ).onModuleInit();

    expect(manifestRegistry.list()).toHaveLength(0);

    new RbacFeatureRegistrations(
      { manifests: [] },
      rbacService,
      scopeResolverRegistry,
      moduleRef,
    ).onModuleInit();

    expect(manifestRegistry.list()).toHaveLength(0);
  });

  it('resolves scope resolver classes via ModuleRef and registers them', () => {
    const ownResolver = new FakeResolver('own');
    const assignedResolver = new FakeResolver('assigned');
    const OwnClass = class {} as unknown as new () => ScopeResolver;
    const AssignedClass = class {} as unknown as new () => ScopeResolver;

    moduleRef = {
      get: vi.fn((cls: unknown) => {
        if (cls === OwnClass) return ownResolver;
        if (cls === AssignedClass) return assignedResolver;
        throw new Error('unknown class');
      }),
    } as unknown as ModuleRef;

    new RbacFeatureRegistrations(
      { scopeResolvers: [OwnClass, AssignedClass] },
      rbacService,
      scopeResolverRegistry,
      moduleRef,
    ).onModuleInit();

    expect(scopeResolverRegistry.has('own')).toBe(true);
    expect(scopeResolverRegistry.has('assigned')).toBe(true);
    expect(moduleRef.get).toHaveBeenCalledWith(OwnClass, { strict: false });
    expect(moduleRef.get).toHaveBeenCalledWith(AssignedClass, { strict: false });
  });

  it('handles both manifests and scope resolvers in a single config', () => {
    const customResolver = new FakeResolver('custom');
    const CustomClass = class {} as unknown as new () => ScopeResolver;

    moduleRef = {
      get: vi.fn(() => customResolver),
    } as unknown as ModuleRef;

    new RbacFeatureRegistrations(
      {
        manifests: [manifest({ slug: 'mixed.read', supportedScopes: ['any', 'custom'] })],
        scopeResolvers: [CustomClass],
      },
      rbacService,
      scopeResolverRegistry,
      moduleRef,
    ).onModuleInit();

    expect(manifestRegistry.has('mixed.read')).toBe(true);
    expect(scopeResolverRegistry.has('custom')).toBe(true);
  });

  it('propagates registry errors (e.g. duplicate manifest slug)', () => {
    manifestRegistry.register(manifest({ slug: 'dup.read' }));

    const registrations = new RbacFeatureRegistrations(
      { manifests: [manifest({ slug: 'dup.read' })] },
      rbacService,
      scopeResolverRegistry,
      moduleRef,
    );

    expect(() => registrations.onModuleInit()).toThrow(
      "Permission manifest 'dup.read' is already registered",
    );
  });
});
