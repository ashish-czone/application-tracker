import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { UserResolution } from '../types';

export interface UserResolutionContext {
  event?: {
    actorId: string | null;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
  };
  entityType?: string;
  entityId?: string;
  entityData?: Record<string, unknown>;
}

export interface UserResolverStrategy {
  readonly type: string;
  readonly label: string;
  readonly configSchema: Record<string, unknown>;

  resolve(resolution: UserResolution, context: UserResolutionContext): Promise<string[]>;
}

@Injectable()
export class UserResolverRegistry {
  private readonly logger: ContextLogger;
  private readonly strategies = new Map<string, UserResolverStrategy>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(UserResolverRegistry.name);
  }

  registerStrategy(strategy: UserResolverStrategy): void {
    this.strategies.set(strategy.type, strategy);
    this.logger.log(`Registered user resolver strategy: ${strategy.type}`);
  }

  getStrategy(type: string): UserResolverStrategy | undefined {
    return this.strategies.get(type);
  }

  getAllStrategies(): UserResolverStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Resolve user IDs for a single user slot using the configured strategy.
   * Returns an empty array if the strategy is unknown or resolution fails.
   */
  async resolve(resolution: UserResolution, context: UserResolutionContext): Promise<string[]> {
    const strategy = this.strategies.get(resolution.strategy);
    if (!strategy) {
      this.logger.warn(`Unknown user resolver strategy: ${resolution.strategy}`);
      return [];
    }

    try {
      return await strategy.resolve(resolution, context);
    } catch (error) {
      this.logger.error(`User resolution failed for strategy "${resolution.strategy}": ${error}`);
      return [];
    }
  }

  /**
   * Resolve all user slots for an action config.
   * Returns a map of slot name -> resolved user IDs.
   */
  async resolveAll(
    users: Record<string, UserResolution>,
    context: UserResolutionContext,
  ): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};

    for (const [slotName, resolution] of Object.entries(users)) {
      result[slotName] = await this.resolve(resolution, context);
    }

    return result;
  }
}
