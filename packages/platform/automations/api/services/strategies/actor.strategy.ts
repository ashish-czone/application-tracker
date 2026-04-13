import type { UserResolution } from '@packages/automation-contracts';
import type { UserResolverStrategy, UserResolutionContext } from '@packages/automation-contracts';

export class ActorStrategy implements UserResolverStrategy {
  readonly type = 'actor';
  readonly label = 'Event Actor';
  readonly configSchema = {};

  async resolve(_resolution: UserResolution, context: UserResolutionContext): Promise<string[]> {
    const actorId = context.event?.actorId;
    if (!actorId) return [];
    return [actorId];
  }
}
