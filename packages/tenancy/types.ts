export type TenancyMode = 'rls' | 'database';
export type TenantResolver = 'subdomain' | 'header' | 'jwt';

export interface TenancyConfig {
  mode: TenancyMode;
  resolver: TenantResolver;
  headerName?: string;
  jwtClaim?: string;
  /** URL of the control-plane API. When set, tenant resolution uses HTTP instead of direct DB. */
  controlPlaneUrl?: string;
}

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  databaseUrl: string;
  status: 'active' | 'suspended' | 'provisioning';
  plan?: string;
  capabilities?: string[];
  planExpiry?: string;
}

/**
 * Abstraction for resolving tenant info.
 *
 * Two implementations:
 * - TenantRegistryService (direct DB) — used by control-plane
 * - TenantHttpLookup (HTTP client) — used by tenant apps
 */
export interface TenantLookup {
  findBySlug(slug: string): Promise<TenantInfo | null>;
  findById(id: string): Promise<TenantInfo | null>;
}

export const TENANCY_CONFIG = Symbol('TENANCY_CONFIG');
export const TENANT_LOOKUP = Symbol('TENANT_LOOKUP');
