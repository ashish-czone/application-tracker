export interface Tenant {
  id: string;
  slug: string;
  name: string;
  databaseUrl: string;
  status: 'active' | 'suspended' | 'provisioning';
  plan?: string;
  capabilities?: string[];
  planExpiry?: string;
  clientId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  databaseUrl?: string;
  status?: 'active' | 'suspended' | 'provisioning';
  plan?: string;
  capabilities?: string[];
  planExpiry?: string;
  clientId?: string;
}
