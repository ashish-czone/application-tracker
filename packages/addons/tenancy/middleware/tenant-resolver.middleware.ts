import { Injectable, Inject, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { setTenantId, getCorrelationId } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { TENANCY_CONFIG, TENANT_LOOKUP, type TenancyConfig, type TenantLookup } from '../types';
import type { TenantAwareDatabaseService } from '../services/tenant-aware-database.service';

/**
 * Middleware that resolves tenant from request header or subdomain.
 *
 * This is the first stage of two-stage tenant resolution:
 * 1. Middleware: header/subdomain (for unauthenticated requests like login)
 * 2. TenantJwtGuard: JWT tenantSlug (for authenticated requests)
 *
 * If the tenant is resolved here, the JWT guard skips (already connected).
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANCY_CONFIG) private readonly config: TenancyConfig,
    @Inject(TENANT_LOOKUP) private readonly tenantLookup: TenantLookup,
    private readonly database: DatabaseService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const slug = this.resolve(req);

    if (!slug) {
      next();
      return;
    }

    const tenant = await this.tenantLookup.findBySlug(slug);
    if (!tenant || tenant.status !== 'active') {
      next();
      return;
    }

    setTenantId(tenant.id);

    // Acquire tenant-scoped DB connection before handler runs
    const requestId = getCorrelationId();
    const tenantDb = this.database as TenantAwareDatabaseService;

    if (tenantDb.acquireForRequest) {
      await tenantDb.acquireForRequest(tenant.id, requestId);

      // Release on response finish
      res.on('finish', () => {
        tenantDb.releaseForRequest(requestId).catch(() => {});
      });
    }

    next();
  }

  private resolve(req: Request): string | undefined {
    switch (this.config.resolver) {
      case 'subdomain':
        return this.resolveFromSubdomain(req);
      case 'header':
      default:
        return this.resolveFromHeader(req);
    }
  }

  private resolveFromSubdomain(req: Request): string | undefined {
    const hostname = req.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
    return undefined;
  }

  private resolveFromHeader(req: Request): string | undefined {
    const headerName = this.config.headerName ?? 'x-tenant-id';
    return req.headers[headerName] as string | undefined;
  }
}
