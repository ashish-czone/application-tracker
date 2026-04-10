import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const PERMISSION_KEY = 'requiredPermission';

/**
 * Mock RBAC guard for package-level controller integration tests.
 *
 * Mirrors the real RbacGuard logic: reads the @RequirePermission metadata,
 * checks request.user.permissions (set by MockAuthGuard), supports wildcard '*'.
 */
@Injectable()
export class MockRbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const userPermissions: Record<string, unknown> = user.permissions ?? {};

    if ('*' in userPermissions) return true;

    if (!(requiredPermission in userPermissions)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
