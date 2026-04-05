export type TenancyMode = 'rls' | 'database';
export type TenantResolver = 'subdomain' | 'header' | 'jwt';

export interface TenancyConfig {
  mode: TenancyMode;
  resolver: TenantResolver;
  headerName?: string;
  jwtClaim?: string;
}

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  databaseUrl: string;
  status: 'active' | 'suspended' | 'provisioning';
}

export const TENANCY_CONFIG = Symbol('TENANCY_CONFIG');
