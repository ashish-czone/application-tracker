import { Injectable, Inject } from '@nestjs/common';
import { ServiceAuthClient } from '@packages/service-auth';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { TENANCY_CONFIG, type TenancyConfig, type TenantInfo, type TenantLookup } from '../types';

/**
 * HTTP-based tenant lookup that calls the control-plane API.
 *
 * Used by tenant apps (not the control-plane itself). Resolves tenant info
 * by calling the control-plane's /internal/tenants endpoints, authenticated
 * via signed JWT (service-auth).
 *
 * Results are cached in-memory with a long TTL since DB URLs and slugs
 * are effectively static.
 */
@Injectable()
export class TenantHttpLookup implements TenantLookup {
  private readonly logger: ContextLogger;
  private readonly controlPlaneUrl: string;
  private readonly slugCache = new Map<string, { tenant: TenantInfo; expiresAt: number }>();
  private readonly idCache = new Map<string, { tenant: TenantInfo; expiresAt: number }>();
  private readonly cacheTtlMs = 30 * 60 * 1000; // 30 minutes

  constructor(
    @Inject(TENANCY_CONFIG) config: TenancyConfig,
    private readonly serviceAuthClient: ServiceAuthClient,
    appLogger: AppLoggerService,
  ) {
    this.controlPlaneUrl = config.controlPlaneUrl!;
    this.logger = appLogger.forContext(TenantHttpLookup.name);
  }

  async findBySlug(slug: string): Promise<TenantInfo | null> {
    const cached = this.slugCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const tenant = await this.fetchTenant(`/internal/tenants/${encodeURIComponent(slug)}`);
    if (tenant) {
      this.cacheResult(tenant);
    }
    return tenant;
  }

  async findById(id: string): Promise<TenantInfo | null> {
    const cached = this.idCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const tenant = await this.fetchTenant(`/internal/tenants/by-id/${encodeURIComponent(id)}`);
    if (tenant) {
      this.cacheResult(tenant);
    }
    return tenant;
  }

  /** Evicts a tenant from the cache (e.g., on connection failure). */
  evict(slug: string): void {
    const cached = this.slugCache.get(slug);
    if (cached) {
      this.idCache.delete(cached.tenant.id);
    }
    this.slugCache.delete(slug);
  }

  private cacheResult(tenant: TenantInfo): void {
    const expiresAt = Date.now() + this.cacheTtlMs;
    this.slugCache.set(tenant.slug, { tenant, expiresAt });
    this.idCache.set(tenant.id, { tenant, expiresAt });
  }

  private async fetchTenant(path: string): Promise<TenantInfo | null> {
    const url = `${this.controlPlaneUrl}${path}`;
    const headers = this.serviceAuthClient.getAuthHeaders('control-plane');

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        this.logger.error('Control-plane lookup failed', {
          url,
          status: response.status,
        });
        return null;
      }

      return await response.json() as TenantInfo;
    } catch (err) {
      this.logger.error('Control-plane lookup error', {
        url,
        error: (err as Error).message,
      }, (err as Error).stack);
      return null;
    }
  }
}
