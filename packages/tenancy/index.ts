// Module
export { TenancyModule, type TenancyModuleAsyncOptions } from './tenancy.module';

// Types & tokens
export { TENANCY_CONFIG, type TenancyConfig, type TenancyMode, type TenantResolver, type TenantInfo } from './types';

// Helpers — the three explicit functions used at every query site
export { withTenant, withTenantInsert, tenantCondition } from './helpers';

// Services
export { TenantRegistryService } from './services/tenant-registry.service';
export { TenantAwareDatabaseService } from './services/tenant-aware-database.service';
