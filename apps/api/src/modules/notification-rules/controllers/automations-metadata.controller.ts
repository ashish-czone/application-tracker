import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { EventRegistryService, type EventMetadata } from '@packages/events';
import { EntityResolverRegistry, type FieldConfig, type RecipientFieldConfig } from '@packages/notifications';
import { NOTIFICATION_RULES_PERMISSIONS } from '../permissions';

interface EntityResolverResponse {
  entityType: string;
  fields: Record<string, FieldConfig>;
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
  listEntities(): EntityResolverResponse[] {
    const all = this.entityResolverRegistry.getAll();
    const result: EntityResolverResponse[] = [];

    for (const [entityType, config] of all) {
      result.push({
        entityType,
        fields: config.fields,
        recipientFields: config.recipientFields,
      });
    }

    return result;
  }
}
