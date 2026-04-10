import { Injectable, Inject, type CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { IS_PUBLIC_KEY } from '@packages/auth-core';
import { setTenantId, getTenantId, getCorrelationId } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { TENANCY_CONFIG, TENANT_LOOKUP, type TenancyConfig, type TenantLookup } from '../types';
import type { TenantAwareDatabaseService } from '../services/tenant-aware-database.service';

/**
 * Second stage of two-stage tenant resolution.
 *
 * Runs after AuthGuard. If the middleware already resolved the tenant
 * (e.g., from header on a login request), this guard skips.
 *
 * For authenticated requests where no header was provided, reads
 * `tenantSlug` from the JWT payload, resolves the tenant, and
 * acquires the DB connection.
 */
@Injectable()
export class TenantJwtGuard implements CanActivate {
  constructor(
    @Inject(TENANCY_CONFIG) private readonly config: TenancyConfig,
    @Inject(TENANT_LOOKUP) private readonly tenantLookup: TenantLookup,
    private readonly database: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // If middleware already resolved the tenant, nothing to do
    if (getTenantId()) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user yet (AuthGuard hasn't run or route is public)
    if (!user) {
      return true;
    }

    const tenantSlug = user.tenantSlug as string | undefined;
    if (!tenantSlug) {
      throw new ForbiddenException('Missing tenant claim in access token');
    }

    const tenant = await this.tenantLookup.findBySlug(tenantSlug);
    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    if (tenant.status !== 'active') {
      throw new ForbiddenException(`Tenant is ${tenant.status}`);
    }

    setTenantId(tenant.id);

    // Acquire tenant-scoped DB connection
    const requestId = getCorrelationId();
    const tenantDb = this.database as TenantAwareDatabaseService;

    if (tenantDb.acquireForRequest) {
      await tenantDb.acquireForRequest(tenant.id, requestId);

      // Register cleanup on response finish
      const response = context.switchToHttp().getResponse<Response>();
      response.on('finish', () => {
        tenantDb.releaseForRequest(requestId).catch(() => {});
      });
    }

    return true;
  }
}
