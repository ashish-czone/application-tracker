import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RbacService, PermissionManifest } from '@packages/rbac';
import type { AppConfigService } from '@packages/settings';
import { AgencyDomainModule } from '../agency.module';
import { AGENCY_PERMISSION_MANIFESTS } from '../permissions';
import { SITE_SETTINGS } from '../settings';

function makeRbac() {
  return { registerManifests: vi.fn() } as unknown as RbacService;
}

function makeAppConfig() {
  return { register: vi.fn() } as unknown as AppConfigService;
}

function newModule() {
  const rbac = makeRbac();
  const appConfig = makeAppConfig();
  const module = new AgencyDomainModule(rbac, appConfig);
  return { module, rbac, appConfig };
}

describe('AgencyDomainModule.onModuleInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the site settings module with AppConfigService', () => {
    const { module, appConfig } = newModule();

    module.onModuleInit();

    expect(appConfig.register).toHaveBeenCalledTimes(1);
    expect(appConfig.register).toHaveBeenCalledWith('site', SITE_SETTINGS);
  });

  it('forwards declared permission manifests to rbac', () => {
    const original = AGENCY_PERMISSION_MANIFESTS.slice();
    AGENCY_PERMISSION_MANIFESTS.length = 0;
    const sample: PermissionManifest[] = [
      { slug: 'alpha.read',  module: 'alpha', action: 'read',   label: 'Read alpha',  description: 'Read alpha',  supportedScopes: ['any'] },
      { slug: 'alpha.write', module: 'alpha', action: 'write',  label: 'Write alpha', description: 'Write alpha', supportedScopes: ['any'] },
      { slug: 'beta.manage', module: 'beta',  action: 'manage', label: 'Manage beta', description: 'Manage beta', supportedScopes: ['any'] },
    ];
    AGENCY_PERMISSION_MANIFESTS.push(...sample);

    try {
      const { module, rbac } = newModule();
      module.onModuleInit();

      expect(rbac.registerManifests).toHaveBeenCalledTimes(1);
      expect(rbac.registerManifests).toHaveBeenCalledWith(sample);
    } finally {
      AGENCY_PERMISSION_MANIFESTS.length = 0;
      AGENCY_PERMISSION_MANIFESTS.push(...original);
    }
  });

  it('calls registerManifests with the empty list when the domain ships no permissions', () => {
    const original = AGENCY_PERMISSION_MANIFESTS.slice();
    AGENCY_PERMISSION_MANIFESTS.length = 0;

    try {
      const { module, rbac, appConfig } = newModule();
      module.onModuleInit();

      expect(rbac.registerManifests).toHaveBeenCalledWith([]);
      expect(appConfig.register).toHaveBeenCalledWith('site', SITE_SETTINGS);
    } finally {
      AGENCY_PERMISSION_MANIFESTS.length = 0;
      AGENCY_PERMISSION_MANIFESTS.push(...original);
    }
  });
});
