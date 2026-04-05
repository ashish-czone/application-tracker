import { Injectable, Inject, type CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@packages/auth-core';
import { setTenantId } from '@packages/logger';
import { TENANCY_CONFIG, type TenancyConfig } from '../types';

/**
 * Guard that resolves tenantId from the JWT payload (set by AuthGuard).
 * Must run AFTER AuthGuard so that request.user is populated.
 *
 * Registered as APP_GUARD only when resolver is 'jwt'.
 */
@Injectable()
export class TenantJwtGuard implements CanActivate {
  constructor(
    @Inject(TENANCY_CONFIG) private readonly config: TenancyConfig,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.resolver !== 'jwt') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    const claim = this.config.jwtClaim ?? 'tenantId';
    const tenantId = user[claim];

    if (!tenantId || typeof tenantId !== 'string') {
      throw new ForbiddenException('Missing tenant claim in access token');
    }

    setTenantId(tenantId);
    return true;
  }
}
