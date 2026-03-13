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
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const entityName = request.authEntityName;

    // No entity name or no config for this entity — pass through
    if (!entityName || !RBAC_CONFIGS_MAP.has(entityName)) {
      return true;
    }

    const permissions = await this.rbacService.getUserPermissions(user.id);

    if (!hasPermission(permissions, requiredPermission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
