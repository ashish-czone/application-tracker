// Module
export { TenancyModule, type TenancyModuleAsyncOptions } from './tenancy.module';
import type { TenancyModuleAsyncOptions } from './tenancy.module';

/**
 * Configurable addon — apps must pass their tenancy mode/resolver/etc.
 * via async factory. Pairs with @packages/service-auth (no migration)
 * which apps add to extraImports separately. The module is loaded lazily
 * so this export can be imported by lightweight CLIs.
 */
export function tenancyAddon(opts: TenancyModuleAsyncOptions) {
  return {
    module: () => require('./tenancy.module').TenancyModule.registerAsync(opts),
    migration: '@packages/tenancy',
  } as const;
}

// Types & tokens
export {
  TENANCY_CONFIG,
  TENANT_LOOKUP,
  type TenancyConfig,
  type TenancyMode,
  type TenantResolver,
  type TenantInfo,
  type TenantLookup,
} from './types';

// Helpers — the three explicit functions used at every query site
export { withTenant, withTenantInsert, tenantCondition } from './helpers';

// Guards & decorators
export { CapabilityGuard } from './guards/capability.guard';
export { RequireCapability, CAPABILITY_KEY } from './decorators/require-capability.decorator';

// Enrichers
export { TenantClaimsEnricher } from './enrichers/tenant-claims-enricher';

// Services
export { TenantRegistryService } from './services/tenant-registry.service';
export { TenantHttpLookup } from './services/tenant-http-lookup';
export { TenantAwareDatabaseService } from './services/tenant-aware-database.service';
