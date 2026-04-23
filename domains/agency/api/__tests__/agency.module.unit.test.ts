import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RbacService } from '@packages/rbac';
import type { AppConfigService } from '@packages/settings';
import { AgencyDomainModule } from '../agency.module';
import { AGENCY_PERMISSION_REGISTRATIONS } from '../permissions';
import { SITE_SETTINGS } from '../settings';

function makeRbac() {
  return { registerPermissions: vi.fn() } as unknown as RbacService;
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

  it('registers permissions grouped by module', () => {
    // Seed a local registration list to assert grouping behaviour independent
    // of whether the current domain ships any permissions.
    const original = AGENCY_PERMISSION_REGISTRATIONS.slice();
    AGENCY_PERMISSION_REGISTRATIONS.length = 0;
    AGENCY_PERMISSION_REGISTRATIONS.push(
      { module: 'alpha', action: 'read', description: 'Read alpha' },
      { module: 'alpha', action: 'write', description: 'Write alpha' },
      { module: 'beta', action: 'manage', description: 'Manage beta' },
    );

    try {
      const { module, rbac } = newModule();
      module.onModuleInit();

      const calls = (rbac.registerPermissions as ReturnType<typeof vi.fn>).mock.calls;
      const byModule = new Map(calls.map(([mod, perms]) => [mod, perms]));
      expect(byModule.get('alpha')).toEqual([
        { action: 'read', description: 'Read alpha' },
        { action: 'write', description: 'Write alpha' },
      ]);
      expect(byModule.get('beta')).toEqual([
        { action: 'manage', description: 'Manage beta' },
      ]);
    } finally {
      AGENCY_PERMISSION_REGISTRATIONS.length = 0;
      AGENCY_PERMISSION_REGISTRATIONS.push(...original);
    }
  });

  it('skips permission registration when no permissions are declared', () => {
    // Domain ships zero permissions today — verify the grouping loop tolerates
    // an empty registration list without throwing.
    const original = AGENCY_PERMISSION_REGISTRATIONS.slice();
    AGENCY_PERMISSION_REGISTRATIONS.length = 0;

    try {
      const { module, rbac, appConfig } = newModule();
      module.onModuleInit();

      expect(rbac.registerPermissions).not.toHaveBeenCalled();
      // Settings registration still happens.
      expect(appConfig.register).toHaveBeenCalledWith('site', SITE_SETTINGS);
    } finally {
      AGENCY_PERMISSION_REGISTRATIONS.length = 0;
      AGENCY_PERMISSION_REGISTRATIONS.push(...original);
    }
  });
});
