import { Injectable, Inject, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { setTenantId } from '@packages/logger';
import { TENANCY_CONFIG, type TenancyConfig } from '../types';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANCY_CONFIG) private readonly config: TenancyConfig,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const tenantId = this.resolve(req);

    if (tenantId) {
      setTenantId(tenantId);
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
        // JWT resolver is handled by TenantJwtGuard, not middleware
        return undefined;
    }
  }

  private resolveFromSubdomain(req: Request): string | undefined {
    const hostname = req.hostname;
    // Extract first subdomain: "acme.app.com" → "acme"
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
