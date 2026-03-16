import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permission required — allow access
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user on request (auth guard should have caught this, but be safe)
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const userPermissions: Record<string, string> = user.permissions ?? {};

    if (!(requiredPermission in userPermissions)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
