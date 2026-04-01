import type { UserResolution } from '../../types';
import type { UserResolverStrategy, UserResolutionContext } from '../user-resolver-registry';

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
