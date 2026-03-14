import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from '@packages/rbac';
import { REQUIRE_PERMISSION_KEY, RBAC_CONFIGS_MAP } from '../constants';
import { RbacService } from '../services/rbac.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission metadata — pass through
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const identity = request.identity;

    if (!identity) {
      throw new ForbiddenException('No authenticated identity');
    }

    const entityName = request.authEntityName;

    // No entity name or no config for this entity — pass through
    if (!entityName || !RBAC_CONFIGS_MAP.has(entityName)) {
      return true;
    }

    // Superadmin bypass — identities with the superadmin role skip permission checks
    const identityRoles = await this.rbacService.getIdentityRoles(identity.id);
    const isSuperadmin = identityRoles.some(
      (ir) => (ir as Record<string, unknown> & { role?: { name?: string } }).role?.name === 'superadmin',
    );
    if (isSuperadmin) {
      return true;
    }

    const permissions = await this.rbacService.getIdentityPermissions(identity.id);

    if (!hasPermission(permissions, requiredPermission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
