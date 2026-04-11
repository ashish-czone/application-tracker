import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import {
  buildConditions,
  EntityResolverRegistry,
} from '@packages/automation-contracts';
import type {
  ActionHandler,
  ActionContext,
  ActionResult,
  UserSlotDefinition,
} from '@packages/automation-contracts';
import type { Condition } from '@packages/common';
import { TaxonomyService } from '../services/taxonomy.service';

@Injectable()
export class TagEntityAction implements ActionHandler {
  readonly type = 'tag_entity';
  readonly label = 'Tag Entity';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {
    entityType: {
      type: 'string',
      required: true,
      label: 'Entity type to tag',
    },
    conditions: {
      type: 'array',
      required: false,
      label: 'Conditions to filter which entities to tag',
    },
    mode: {
      type: 'string',
      required: true,
      label: 'add or remove',
    },
    tagIds: {
      type: 'array',
      required: true,
      label: 'Tag IDs to add or remove',
    },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly taxonomyService: TaxonomyService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(TagEntityAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const config = context.actionConfig.config as {
      entityType?: string;
      conditions?: Condition[];
      mode?: 'add' | 'remove';
      tagIds?: string[];
    };

    if (!config.entityType) {
      this.logger.warn(`No entityType configured for tag_entity action in rule ${context.rule.id}`);
      return {};
    }

    if (!config.mode || !['add', 'remove'].includes(config.mode)) {
      this.logger.warn(`Invalid mode "${config.mode}" for tag_entity action in rule ${context.rule.id}`);
      return {};
    }

    if (!config.tagIds || config.tagIds.length === 0) {
      this.logger.warn(`No tagIds configured for tag_entity action in rule ${context.rule.id}`);
      return {};
    }

    const entityResolver = this.entityResolverRegistry.get(config.entityType);
    if (!entityResolver) {
      this.logger.warn(`No entity resolver found for type "${config.entityType}"`);
      return {};
    }

    // Build SQL conditions to find matching entities
    const conditions = config.conditions ?? [];
    const allowedFields = Object.keys(entityResolver.fields);
    const sqlConditions = buildConditions(entityResolver.table, conditions, allowedFields);

    const idColumn = (entityResolver.table as Record<string, any>).id;
    const whereClause = withTenant(entityResolver.table, ...sqlConditions);

    const entities = await this.database.db
      .select({ id: idColumn })
      .from(entityResolver.table)
      .where(whereClause);

    if (entities.length === 0) {
      this.logger.debug('No entities matched conditions for tag_entity action', {
        entityType: config.entityType,
        ruleId: context.rule.id,
      });
      return {};
    }

    let taggedCount = 0;

    for (const entity of entities) {
      for (const tagId of config.tagIds) {
        try {
          if (config.mode === 'add') {
            await this.taxonomyService.attachTag(config.entityType, entity.id as string, tagId);
          } else {
            await this.taxonomyService.detachTag(config.entityType, entity.id as string, tagId);
          }
          taggedCount++;
        } catch (error) {
          this.logger.warn(`Failed to ${config.mode} tag ${tagId} on ${config.entityType}/${entity.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.logger.debug(`Tagged ${taggedCount} entity-tag pairs`, {
      entityType: config.entityType,
      mode: config.mode,
      matchedEntities: entities.length,
      tagCount: config.tagIds.length,
      ruleId: context.rule.id,
    });

    return {};
  }
}
