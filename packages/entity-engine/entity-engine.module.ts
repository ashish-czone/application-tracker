import { Module, Global, type DynamicModule, type OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter, EventRegistryService } from '@packages/events';
import { RbacService } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { FieldValueService, FieldDefinitionService, LayoutService, LookupResolverService } from '@packages/eav-attributes';
import { EntityResolverRegistry } from '@packages/notifications';
import { AppLoggerService } from '@packages/logger';
import { EntityRegistryService } from './entity-registry.service';
import { EntityService } from './entity.service';
import { createEntityController } from './create-entity-controller';
import { seedEntityFields } from './seed-entity-fields';
import type { EntityConfig } from './types';

/**
 * Core entity engine module.
 *
 * Usage:
 * ```
 * @Module({
 *   imports: [
 *     EntityEngineModule,                           // once in root
 *     EntityEngineModule.forEntity(CANDIDATES_CONFIG),  // per entity
 *   ],
 * })
 * ```
 */
@Global()
@Module({
  providers: [EntityRegistryService],
  exports: [EntityRegistryService],
})
export class EntityEngineModule {
  /**
   * Register a single entity with the engine.
   * Creates a dynamic module with:
   * - An EntityService instance bound to this config
   * - An auto-generated REST controller
   * - Auto-registration of RBAC, events, audit, lookup on init
   * - Field definition + layout seeding
   */
  static forEntity(config: EntityConfig): DynamicModule {
    const serviceToken = `ENTITY_SERVICE_${config.entityType}`;
    const ControllerClass = createEntityController(config, serviceToken);

    // Create an init provider that handles all registrations + seeding
    const initProviderToken = `ENTITY_INIT_${config.entityType}`;

    return {
      module: EntityEngineModule,
      controllers: [ControllerClass],
      providers: [
        // EntityService instance for this entity
        {
          provide: serviceToken,
          useFactory: (
            database: DatabaseService,
            domainEventEmitter: DomainEventEmitter,
            fieldValueService: FieldValueService,
            fieldDefinitionService: FieldDefinitionService,
            appLogger: AppLoggerService,
          ) => new EntityService(config, database, domainEventEmitter, fieldValueService, fieldDefinitionService, appLogger),
          inject: [DatabaseService, DomainEventEmitter, FieldValueService, FieldDefinitionService, AppLoggerService],
        },
        // Init provider: registers RBAC, events, audit, lookup, seeds fields
        {
          provide: initProviderToken,
          useFactory: (
            registry: EntityRegistryService,
            rbac: RbacService,
            eventRegistry: EventRegistryService,
            auditRegistry: AuditRegistryService,
            lookupResolver: LookupResolverService,
            entityResolver: EntityResolverRegistry,
            fieldDefService: FieldDefinitionService,
            layoutService: LayoutService,
          ) => {
            return new EntityInitializer(
              config, registry, rbac, eventRegistry, auditRegistry,
              lookupResolver, entityResolver, fieldDefService, layoutService,
            );
          },
          inject: [
            EntityRegistryService,
            RbacService,
            EventRegistryService,
            AuditRegistryService,
            LookupResolverService,
            EntityResolverRegistry,
            FieldDefinitionService,
            LayoutService,
          ],
        },
      ],
      exports: [serviceToken],
    };
  }
}

/**
 * Handles all one-time registrations and seeding for an entity.
 * Created via factory provider and initialized by NestJS lifecycle.
 */
class EntityInitializer implements OnModuleInit {
  private readonly logger = new Logger(`EntityInit[${this.config.entityType}]`);

  constructor(
    private readonly config: EntityConfig,
    private readonly registry: EntityRegistryService,
    private readonly rbac: RbacService,
    private readonly eventRegistry: EventRegistryService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly lookupResolver: LookupResolverService,
    private readonly entityResolver: EntityResolverRegistry,
    private readonly fieldDefService: FieldDefinitionService,
    private readonly layoutService: LayoutService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { config } = this;

    // 1. Register in entity registry
    this.registry.register(config);

    // 2. RBAC — register CRUD permissions + any extras
    const permissions = [
      { action: 'create', description: `Create ${config.pluralName.toLowerCase()}` },
      { action: 'read', description: `View ${config.pluralName.toLowerCase()}` },
      { action: 'update', description: `Update ${config.pluralName.toLowerCase()}` },
      { action: 'delete', description: `Delete ${config.pluralName.toLowerCase()}` },
      ...(config.extraPermissions ?? []),
    ];
    this.rbac.registerPermissions(config.slug, permissions);

    // 3. Events — register created/updated/deleted + any extras
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

    // 4. Audit — register events to log
    this.auditRegistry.register(config.entityType, {
      events: [createdEvent, updatedEvent, deletedEvent],
    });

    // 5. Entity resolver — for notification conditions
    if (config.recipientFields) {
      this.entityResolver.register(config.entityType, {
        table: config.table,
        fields: {},
        recipientFields: config.recipientFields,
      });
    }

    // 6. Lookup — register as lookup target
    if (config.lookup) {
      this.lookupResolver.register({
        entity: config.entityType,
        table: config.table,
        labelField: config.lookup.labelField,
        valueField: 'id',
        searchFields: config.lookup.searchFields,
      });
    }

    // 7. Seed field definitions + layout
    try {
      await seedEntityFields(config, this.fieldDefService, this.layoutService);
      this.logger.log(`Seeded field definitions and layout for ${config.entityType}`);
    } catch (error) {
      this.logger.warn(`Failed to seed fields for ${config.entityType}: ${(error as Error).message}`);
    }
  }
}
