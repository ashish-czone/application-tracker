import { Injectable } from '@nestjs/common';
import { inArray, or, type SQL } from '@packages/database';
import type { ScopeResolver, ScopeResolverContext } from '@packages/rbac';
import { PositionScopeResolverService } from '../services/position-scope-resolver.service';

type HierarchyScopeType = 'unit' | 'descendants';

/**
 * Base for hierarchy-aware scope resolvers. `unit` covers the actor's direct
 * org units; `descendants` extends to the full subtree. Both translate into
 * the same shape of WHERE clause: OR across the anchor columns against the
 * expanded user-id / org-unit-id lists. The only difference is which list
 * the position service returns for the given scope type.
 *
 * A resolver returns `undefined` — meaning "no-op for this entity" — when
 * none of the anchor columns match, or when the expansion is empty.
 */
abstract class HierarchyScopeResolver implements ScopeResolver {
  abstract readonly type: HierarchyScopeType;
  readonly requiredAnchors = ['creator', 'assignee', 'team'] as const;

  constructor(protected readonly positionScopeResolver: PositionScopeResolverService) {}

  async resolve(ctx: ScopeResolverContext): Promise<SQL | undefined> {
    const userIds = await this.positionScopeResolver.resolveUserIds(ctx.userId, this.type);
    const unitIds = await this.positionScopeResolver.resolveOrgUnitIds(ctx.userId, this.type);

    const predicates: SQL[] = [];

    if (userIds && userIds.length > 0) {
      if (ctx.anchors.creator) predicates.push(inArray(ctx.anchors.creator, userIds));
      if (ctx.anchors.assignee) predicates.push(inArray(ctx.anchors.assignee, userIds));
    }
    if (unitIds && unitIds.length > 0 && ctx.anchors.team) {
      predicates.push(inArray(ctx.anchors.team, unitIds));
    }

    if (predicates.length === 0) return undefined;
    if (predicates.length === 1) return predicates[0];
    return or(...predicates)!;
  }
}

/** `unit` — rows tied to the actor's direct org units (no descendants). */
@Injectable()
export class UnitScopeResolver extends HierarchyScopeResolver {
  readonly type = 'unit' as const;
  constructor(positionScopeResolver: PositionScopeResolverService) {
    super(positionScopeResolver);
  }
}

/** `descendants` — rows tied to the actor's unit subtree. */
@Injectable()
export class DescendantsScopeResolver extends HierarchyScopeResolver {
  readonly type = 'descendants' as const;
  constructor(positionScopeResolver: PositionScopeResolverService) {
    super(positionScopeResolver);
  }
}
