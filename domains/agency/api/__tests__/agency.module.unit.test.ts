import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppConfigService } from '@packages/settings';
import { AgencyDomainModule } from '../agency.module';
import { AGENCY_PERMISSION_MANIFESTS } from '../permissions';
import { SITE_SETTINGS } from '../settings';

function makeAppConfig() {
  return { register: vi.fn() } as unknown as AppConfigService;
}

describe('AgencyDomainModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the site settings module with AppConfigService in onModuleInit', () => {
    const appConfig = makeAppConfig();
    const module = new AgencyDomainModule(appConfig);

    module.onModuleInit();

    expect(appConfig.register).toHaveBeenCalledTimes(1);
    expect(appConfig.register).toHaveBeenCalledWith('site', SITE_SETTINGS);
  });

  it('wires AGENCY_PERMISSION_MANIFESTS into the module imports via RbacIntegrationModule', () => {
    // Permission registration is performed declaratively via the
    // RbacIntegrationModule.forFeature({ manifests }) entry in `imports` —
    // RbacIntegrationModule's own unit tests cover the actual registration
    // logic. Here we just verify the wiring is present and points at the
    // canonical AGENCY_PERMISSION_MANIFESTS array.
    const imports = Reflect.getMetadata('imports', AgencyDomainModule) as Array<{
      module: { name: string };
      providers?: Array<{ provide?: symbol | string; useValue?: { manifests?: unknown } }>;
    }>;
    const rbacEntry = imports.find((m) => m?.module?.name === 'RbacIntegrationModule');
    expect(rbacEntry).toBeDefined();
    const configProvider = rbacEntry!.providers!.find(
      (p) => typeof p === 'object' && p !== null && 'useValue' in p,
    );
    expect(configProvider?.useValue?.manifests).toBe(AGENCY_PERMISSION_MANIFESTS);
  });
});
