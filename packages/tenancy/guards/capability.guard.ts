import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@packages/auth-core';
import { CAPABILITY_KEY } from '../decorators/require-capability.decorator';

/**
 * Guards routes by subscription capability.
 *
 * Reads the `capabilities` array from the JWT payload (request.user.capabilities)
 * and checks whether the required capability (set via @RequireCapability()) is present.
 *
 * Registered as APP_GUARD inside TenancyModule — only exists when tenancy is active.
 * When tenancy is not loaded, this guard does not exist.
 *
 * If the guard IS loaded and capabilities are missing from the JWT, it rejects with 403.
 * This is intentional — "missing capabilities" in a multi-tenant deployment is never
 * treated as "allow all".
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredCapability = this.reflector.getAllAndOverride<string>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequireCapability() decorator → no capability check needed
    if (!requiredCapability) {
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
      throw new ForbiddenException('Authentication required for capability check');
    }

    const capabilities: string[] | undefined = user.capabilities;

    if (!capabilities || !Array.isArray(capabilities)) {
      throw new ForbiddenException('Subscription capabilities not available');
    }

    if (!capabilities.includes(requiredCapability)) {
      throw new ForbiddenException(
        `Subscription plan does not include the "${requiredCapability}" capability`,
      );
    }

    return true;
  }
}
