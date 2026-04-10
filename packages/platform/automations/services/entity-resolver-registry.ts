import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { EntityResolverConfig, ResolvedEntityFieldConfig, EntityUserFieldConfig } from '../types';

@Injectable()
export class EntityResolverRegistry {
  private readonly logger: ContextLogger;
  private readonly resolvers = new Map<string, EntityResolverConfig>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(EntityResolverRegistry.name);
  }

  register(entityType: string, config: EntityResolverConfig): void {
    this.resolvers.set(entityType, config);
    const fieldNames = Object.keys(config.fields);
    const userFieldNames = Object.keys(config.userFields);
    this.logger.log(`Registered entity resolver: ${entityType} (fields: ${fieldNames.join(', ')}, userFields: ${userFieldNames.join(', ')})`);
  }

  get(entityType: string): EntityResolverConfig | undefined {
    return this.resolvers.get(entityType);
  }

  getFilterableFields(entityType: string): string[] {
    const config = this.resolvers.get(entityType);
    return config ? Object.keys(config.fields) : [];
  }

  has(entityType: string): boolean {
    return this.resolvers.has(entityType);
  }

  getAll(): Map<string, EntityResolverConfig> {
    return this.resolvers;
  }

  async resolveAllFields(entityType: string): Promise<{
    fields: Record<string, ResolvedEntityFieldConfig>;
    userFields: Record<string, EntityUserFieldConfig>;
  } | null> {
    const config = this.resolvers.get(entityType);
    if (!config) return null;

    const resolvedFields: Record<string, ResolvedEntityFieldConfig> = {};

    for (const [fieldName, fieldConfig] of Object.entries(config.fields)) {
      let options = fieldConfig.options;

      if (fieldConfig.resolveOptions) {
        try {
          options = await fieldConfig.resolveOptions();
        } catch (error) {
          this.logger.warn(`Failed to resolve options for ${entityType}.${fieldName}: ${error}`);
          options = [];
        }
      }

      resolvedFields[fieldName] = {
        type: fieldConfig.type,
        label: fieldConfig.label,
        ...(options && options.length > 0 ? { options } : {}),
      };
    }

    return {
      fields: resolvedFields,
      userFields: config.userFields,
    };
  }
}
