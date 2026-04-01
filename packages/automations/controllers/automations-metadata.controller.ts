import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { EventRegistryService, type EventMetadata } from '@packages/events';
import { EntityResolverRegistry } from '../services/entity-resolver-registry';
import { ActionRegistry } from '../services/action-registry';
import { UserResolverRegistry } from '../services/user-resolver-registry';
import type { ResolvedEntityFieldConfig, EntityUserFieldConfig } from '../types';
import { AUTOMATION_PERMISSIONS } from '../permissions';

interface EntityResolverResponse {
  entityType: string;
  fields: Record<string, ResolvedEntityFieldConfig>;
  userFields: Record<string, EntityUserFieldConfig>;
}

@ApiTags('automations')
@Controller('automations')
export class AutomationsMetadataController {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly actionRegistry: ActionRegistry,
    private readonly userResolverRegistry: UserResolverRegistry,
  ) {}

  @Get('events')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List all registered domain events for automation triggers' })
  listEvents(): EventMetadata[] {
    return this.eventRegistry.getAll();
  }

  @Get('entities')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List registered entity types with filterable fields and user fields' })
  async listEntities(): Promise<EntityResolverResponse[]> {
    const all = this.entityResolverRegistry.getAll();
    const result: EntityResolverResponse[] = [];

    for (const [entityType] of all) {
      const resolved = await this.entityResolverRegistry.resolveAllFields(entityType);
      if (resolved) {
        result.push({ entityType, ...resolved });
      }
    }

    return result;
  }

  @Get('action-types')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List registered automation action types with config schemas' })
  listActionTypes() {
    return this.actionRegistry.getAllMetadata();
  }

  @Get('user-strategies')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List registered user resolution strategies' })
  listUserStrategies() {
    return this.userResolverRegistry.getAllStrategies().map((s) => ({
      type: s.type,
      label: s.label,
      configSchema: s.configSchema,
    }));
  }
}
