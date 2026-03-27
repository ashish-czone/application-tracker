import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { EventRegistryService, type EventMetadata } from '@packages/events';
import { EntityResolverRegistry } from '../services/entity-resolver-registry';
import type { ResolvedFieldConfig, RecipientFieldConfig } from '../types';
import { NOTIFICATION_RULES_PERMISSIONS } from '../permissions';

interface EntityResolverResponse {
  entityType: string;
  fields: Record<string, ResolvedFieldConfig>;
  recipientFields: Record<string, RecipientFieldConfig>;
}

@ApiTags('automations')
@Controller('automations')
export class AutomationsMetadataController {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
  ) {}

  @Get('events')
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List all registered domain events for automation triggers' })
  listEvents(): EventMetadata[] {
    return this.eventRegistry.getAll();
  }

  @Get('entities')
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List registered entity types with filterable fields and recipient fields' })
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
}
