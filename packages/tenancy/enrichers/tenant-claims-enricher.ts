import { Injectable, Inject } from '@nestjs/common';
import type { JwtClaimsEnricher, JwtPayload } from '@packages/auth-core';
import { TENANT_LOOKUP, type TenantLookup } from '../types';

/**
 * Enriches JWT claims with tenant subscription data at login/refresh time.
 *
 * Reads the tenant's slug, plan, and capabilities from the TenantLookup
 * and merges them into the JWT payload. This allows the tenant app to
 * make authorization decisions (CapabilityGuard) without calling the
 * control-plane on every request.
 */
@Injectable()
export class TenantClaimsEnricher implements JwtClaimsEnricher {
  constructor(
    @Inject(TENANT_LOOKUP) private readonly tenantLookup: TenantLookup,
  ) {}

  async enrich(payload: JwtPayload): Promise<JwtPayload> {
    const tenantId = payload.tenantId as string | undefined;
    if (!tenantId) return payload;

    const tenant = await this.tenantLookup.findById(tenantId);
    if (!tenant) return payload;

    return {
      ...payload,
      tenantSlug: tenant.slug,
      plan: tenant.plan,
      capabilities: tenant.capabilities,
    };
  }
}
