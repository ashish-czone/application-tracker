// Module
export { TenancyModule, type TenancyModuleAsyncOptions } from './tenancy.module';

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

// Services
export { TenantRegistryService } from './services/tenant-registry.service';
export { TenantHttpLookup } from './services/tenant-http-lookup';
export { TenantAwareDatabaseService } from './services/tenant-aware-database.service';
