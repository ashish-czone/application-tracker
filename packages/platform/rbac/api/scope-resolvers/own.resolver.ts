import { Injectable } from '@nestjs/common';
import { eq, type SQL } from '@packages/database';
import type { ScopeResolver, ScopeResolverContext } from '../scope-resolver';

/**
 * `own` scope — rows created by the acting user. Needs a `creator` anchor
 * on the entity; entities without one can't support this scope.
 */
@Injectable()
export class OwnScopeResolver implements ScopeResolver {
  readonly type = 'own';
  readonly requiredAnchors = ['creator'] as const;

  resolve(ctx: ScopeResolverContext): SQL | undefined {
    const creator = ctx.anchors.creator;
    if (!creator) return undefined;
    return eq(creator, ctx.userId);
  }
}
