import { Module, Global, type DynamicModule, type OnModuleInit, Logger, Inject, type OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter, EventRegistryService } from '@packages/events';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { FieldValueService, FieldDefinitionService, LayoutService, LookupResolverService } from '@packages/eav-attributes';
import { EntityResolverRegistry } from '@packages/notifications';
import { TaxonomyService } from '@packages/taxonomy';
import { AppLoggerService } from '@packages/logger';
import { EntityRegistryService } from './entity-registry.service';
import { EntityService } from './entity.service';
import { EntityEngineApiController } from './entity-engine-api.controller';
import { createEntityController } from './create-entity-controller';
import { seedEntityFields } from './seed-entity-fields';
import type { EntityConfig } from './types';

// Collect configs that need initialization — populated by forEntity(), consumed by EntityEngineModule.onModuleInit()
const pendingConfigs: EntityConfig[] = [];

/**
 * Core entity engine module.
 *
 * Usage:
 * ```
 * @Module({
 *   imports: [
 *     EntityEngineModule,                               // once in root
 *     EntityEngineModule.forEntity(CANDIDATES_CONFIG),   // per entity
 *   ],
 * })
 * ```
 */
@Global()
@Module({
  controllers: [EntityEngineApiController],
  providers: [EntityRegistryService],
  exports: [EntityRegistryService],
})
export class EntityEngineModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('EntityEngineModule');

  constructor(
    private readonly registry: EntityRegistryService,
    private readonly rbac: RbacService,
    private readonly eventRegistry: EventRegistryService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly lookupResolver: LookupResolverService,
    private readonly entityResolver: EntityResolverRegistry,
    private readonly fieldDefService: FieldDefinitionService,
    private readonly layoutService: LayoutService,
  ) {}

  /**
   * Register a single entity with the engine.
   */
  static forEntity(config: EntityConfig): DynamicModule {
    const serviceToken = `ENTITY_SERVICE_${config.entityType}`;
    const ControllerClass = createEntityController(config, serviceToken);

    // Queue config for initialization (happens in onApplicationBootstrap)
    pendingConfigs.push(config);

    return {
      module: EntityEngineModule,
      controllers: [ControllerClass],
      providers: [
        {
          provide: serviceToken,
          useFactory: (
            database: DatabaseService,
            domainEventEmitter: DomainEventEmitter,
            fieldValueService: FieldValueService,
            fieldDefinitionService: FieldDefinitionService,
            lookupResolver: LookupResolverService,
            taxonomyService: TaxonomyService,
            appLogger: AppLoggerService,
          ) => new EntityService(config, database, domainEventEmitter, fieldValueService, fieldDefinitionService, lookupResolver, taxonomyService, appLogger),
          inject: [DatabaseService, DomainEventEmitter, FieldValueService, FieldDefinitionService, LookupResolverService, TaxonomyService, AppLoggerService],
        },
      ],
      exports: [serviceToken],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    // Process all queued entity configs
    while (pendingConfigs.length > 0) {
      const config = pendingConfigs.shift()!;
      await this.initializeEntity(config);
    }
  }

  private async initializeEntity(config: EntityConfig): Promise<void> {
    // 1. Register in entity registry
    this.registry.register(config);

    // 2. RBAC
    const permissions = [
      { action: 'create', description: `Create ${config.pluralName.toLowerCase()}` },
      { action: 'read', description: `View ${config.pluralName.toLowerCase()}` },
      { action: 'update', description: `Update ${config.pluralName.toLowerCase()}` },
      { action: 'delete', description: `Delete ${config.pluralName.toLowerCase()}` },
      ...(config.extraPermissions ?? []),
    ];
    this.rbac.registerPermissions(config.slug, permissions);

    // 3. Events
    const createdEvent = `${config.entityType}.Created`;
    const updatedEvent = `${config.entityType}.Updated`;
    const deletedEvent = `${config.entityType}.Deleted`;

    this.eventRegistry.register({
      eventName: createdEvent,
      group: config.entityType,
      description: `Fired when a new ${config.singularName.toLowerCase()} is created`,
      payloadSchema: {},
    });
    this.eventRegistry.register({
      eventName: updatedEvent,
      group: config.entityType,
      description: `Fired when a ${config.singularName.toLowerCase()} is updated`,
      payloadSchema: { changes: { type: 'string', label: 'Changed Fields' } },
    });
    this.eventRegistry.register({
      eventName: deletedEvent,
      group: config.entityType,
      description: `Fired when a ${config.singularName.toLowerCase()} is deleted`,
      payloadSchema: {},
    });

    // 4. Audit
    this.auditRegistry.register(config.entityType, {
      events: [createdEvent, updatedEvent, deletedEvent],
    });

    // 5. Entity resolver
    if (config.recipientFields) {
      this.entityResolver.register(config.entityType, {
        table: config.table,
        fields: {},
        recipientFields: config.recipientFields,
      });
    }

    // 6. Lookup
    if (config.lookup) {
      this.lookupResolver.register({
        entity: config.entityType,
        table: config.table,
        labelField: config.lookup.labelField,
        valueField: 'id',
        searchFields: config.lookup.searchFields,
      });
    }

    // 7. Seed fields + layout
    try {
      await seedEntityFields(config, this.fieldDefService, this.layoutService);
      this.logger.log(`Initialized entity: ${config.entityType} (/${config.slug})`);
    } catch (error) {
      this.logger.warn(`Failed to seed fields for ${config.entityType}: ${(error as Error).message}`);
    }
  }
}
