import { Injectable, Inject, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { setTenantId, getCorrelationId } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { TENANCY_CONFIG, type TenancyConfig } from '../types';
import type { TenantAwareDatabaseService } from '../services/tenant-aware-database.service';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANCY_CONFIG) private readonly config: TenancyConfig,
    private readonly database: DatabaseService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const tenantId = this.resolve(req);

    if (!tenantId) {
      next();
      return;
    }

    setTenantId(tenantId);

    // Acquire tenant-scoped DB connection before handler runs
    const requestId = getCorrelationId();
    const tenantDb = this.database as TenantAwareDatabaseService;

    if (tenantDb.acquireForRequest) {
      await tenantDb.acquireForRequest(tenantId, requestId);

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
        return this.resolveFromHeader(req);
      case 'jwt':
        return undefined;
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
