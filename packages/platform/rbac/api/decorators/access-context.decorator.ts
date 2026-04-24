import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@packages/auth-core';
import { PERMISSION_KEY } from './require-permission.decorator';
import { buildAccessContext, type DataAccessContext } from '../scope-context';

/**
 * Resolves the caller's `DataAccessContext` for the permission declared on
 * the current handler via `@RequirePermission`. The context is what services
 * use to apply row-level scope filtering.
 *
 * Usage:
 *
 *   @Get()
 *   @RequirePermission('candidates.read')
 *   list(@AccessContext() accessCtx?: DataAccessContext) {
 *     return this.service.list(query, accessCtx);
 *   }
 *
 * Returns `undefined` when:
 * - the request has no authenticated user (upstream auth guard should catch);
 * - the handler carries no `@RequirePermission` metadata (no verb to scope against);
 * - the user holds no grant for the permission (upstream `RbacGuard` should catch).
 *
 * Services treat `undefined` as "skip scope filtering" — safe because any
 * unauthenticated/unauthorised caller has already been rejected by the guard
 * chain before this decorator runs.
 */
export const AccessContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DataAccessContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) return undefined;

    const permission = Reflect.getMetadata(PERMISSION_KEY, ctx.getHandler()) as string | undefined;
    if (!permission) return undefined;

    return buildAccessContext(user, permission);
  },
);
