import { Injectable } from '@nestjs/common';
import { eq, type SQL } from '@packages/database';
import type { ScopeResolver, ScopeResolverContext } from '../scope-resolver';

/**
 * `assigned` scope — rows currently assigned to the acting user. Needs an
 * `assignee` anchor on the entity.
 */
@Injectable()
export class AssignedScopeResolver implements ScopeResolver {
  readonly type = 'assigned';

  resolve(ctx: ScopeResolverContext): SQL | undefined {
    const assignee = ctx.anchors.assignee;
    if (!assignee) return undefined;
    return eq(assignee, ctx.userId);
  }
}
