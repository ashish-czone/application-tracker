import { Module, Global, type DynamicModule, type OnModuleInit, Logger, Inject, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter, EventRegistryService } from '@packages/events';
import { RbacService, FIELD_PERMISSION_ENTITY_RESOLVER, FieldPermissionsController } from '@packages/rbac';
import type { FieldPermissionEntityResolver } from '@packages/rbac';
import { AuditRegistryService } from '@packages/audit';
import { EntityResolverRegistry } from '@packages/notifications';
import { TaxonomyService } from '@packages/taxonomy';
import { WorkflowEngineService, WorkflowRegistryService, WorkflowGuardRegistry, PipelineResolverService } from '@packages/workflows';
import { AppLoggerService } from '@packages/logger';
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from './field-types';
import { EntityRegistryService } from './entity-registry.service';
import { EntityService } from './entity.service';
import { EntityEngineApiController } from './entity-engine-api.controller';
import { FieldsController } from './controllers/fields.controller';
import { LookupsController } from './controllers/lookups.controller';
import { FieldDefinitionService } from './services/field-definition.service';
import { FieldTypeSaveHookRegistry, fieldTypeSaveHookRegistry } from './services/field-type-save-hook.registry';
import { LookupResolverService } from './services/lookup-resolver.service';
import { createEntityController } from './create-entity-controller';
import { seedEntityFields, seedWorkflows } from './seed-entity-fields';
import { EAV_STORAGE_EXTENSION, type EavStorageExtension } from './extensions/eav-storage.interface';
import { MULTI_VALUE_EXTENSION, type MultiValueExtension } from './extensions/multi-value-extension.interface';
import { LAYOUT_EXTENSION, type LayoutExtension } from './extensions/layout-extension.interface';
import type { EntityConfig } from './types';

// Collect configs that need initialization — populated by forEntity(), consumed by EntityEngineModule.onModuleInit()
const pendingConfigs: EntityConfig[] = [];

/**
 * Core entity engine module.
 *
 * Works standalone for schema-column CRUD. Optional extensions:
 * - EavAttributesModule → provides EAV_STORAGE_EXTENSION for dynamic field storage
 * - EntityLayoutModule → provides LAYOUT_EXTENSION for DB-driven layout customization
 *
 * Usage:
 * ```
 * @Module({
 *   imports: [
 *     EntityEngineModule,                               // once in root
 *     EntityEngineModule.forEntity(candidatesConfig),     // per entity
 *     EavAttributesModule,                               // optional: dynamic fields
 *     EntityLayoutModule,                                // optional: layout customization
 *   ],
 * })
 * ```
 */
@Global()
@Module({
  controllers: [EntityEngineApiController, FieldPermissionsController, FieldsController, LookupsController],
  providers: [
    EntityRegistryService,
    FieldDefinitionService,
    LookupResolverService,
    { provide: FieldTypeSaveHookRegistry, useValue: fieldTypeSaveHookRegistry },
    {
      provide: FIELD_PERMISSION_ENTITY_RESOLVER,
      useFactory: (registry: EntityRegistryService): FieldPermissionEntityResolver => ({
        resolve(entityType: string) {
          const config = registry.get(entityType);
          if (!config) return undefined;
          return { slug: config.slug, fieldMeta: config.fieldMeta };
        },
      }),
      inject: [EntityRegistryService],
    },
    {
      provide: 'FIELD_DEFINITION_SERVICE',
      useExisting: FieldDefinitionService,
    },
  ],
  exports: [EntityRegistryService, FieldDefinitionService, LookupResolverService, FieldTypeSaveHookRegistry, FIELD_PERMISSION_ENTITY_RESOLVER, 'FIELD_DEFINITION_SERVICE'],
})
export class EntityEngineModule implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger('EntityEngineModule');

  constructor(
    private readonly registry: EntityRegistryService,
    private readonly rbac: RbacService,
    private readonly eventRegistry: EventRegistryService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly lookupResolver: LookupResolverService,
    private readonly entityResolver: EntityResolverRegistry,
    private readonly fieldDefService: FieldDefinitionService,
    @Inject(LAYOUT_EXTENSION) @Optional() private readonly layoutExtension: LayoutExtension | null,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly workflowGuardRegistry: WorkflowGuardRegistry,
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
            eavStorage: EavStorageExtension | null,
            multiValueExtension: MultiValueExtension | null,
            fieldDefinitionService: FieldDefinitionService,
            lookupResolver: LookupResolverService,
            taxonomyService: TaxonomyService,
            hookRegistry: FieldTypeSaveHookRegistry,
            workflowEngine: WorkflowEngineService,
            workflowRegistry: WorkflowRegistryService,
            pipelineResolver: PipelineResolverService,
            entityRegistry: EntityRegistryService,
            appLogger: AppLoggerService,
          ) => new EntityService(config, database, domainEventEmitter, eavStorage, multiValueExtension, fieldDefinitionService, lookupResolver, taxonomyService, hookRegistry, workflowEngine, workflowRegistry, pipelineResolver, entityRegistry, appLogger),
          inject: [DatabaseService, DomainEventEmitter, { token: EAV_STORAGE_EXTENSION, optional: true }, { token: MULTI_VALUE_EXTENSION, optional: true }, FieldDefinitionService, LookupResolverService, TaxonomyService, FieldTypeSaveHookRegistry, WorkflowEngineService, WorkflowRegistryService, PipelineResolverService, EntityRegistryService, AppLoggerService],
        },
      ],
      exports: [serviceToken],
    };
  }

  onModuleInit() {
    // Initialize field type registry with core types (if not already populated)
    if (!fieldTypeRegistry.has('text')) {
      fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
    }

    this.rbac.registerPermissions('eav', [
      { action: 'read', description: 'View field definitions and layouts' },
      { action: 'manage', description: 'Create/update/delete custom fields and layouts' },
    ]);
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

    // 3b. Workflow field transition events (e.g. "applications.StageChanged")
    const transitionEvents: string[] = [];
    for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
      if (meta.fieldType !== 'workflow') continue;
      const pascalField = fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
      const eventName = `${config.entityType}.${pascalField}Changed`;
      transitionEvents.push(eventName);
      this.eventRegistry.register({
        eventName,
        group: config.entityType,
        description: `Fired when a ${config.singularName.toLowerCase()}'s ${meta.label.toLowerCase()} changes`,
        payloadSchema: {
          fromState: { type: 'string', label: `Previous ${meta.label}` },
          toState: { type: 'string', label: `New ${meta.label}` },
          transitionName: { type: 'string', label: 'Transition' },
        },
      });
    }

    // 4. Audit
    this.auditRegistry.register(config.entityType, {
      events: [createdEvent, updatedEvent, deletedEvent, ...transitionEvents],
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

    // 7. Seed fields
    try {
      await seedEntityFields(config, this.fieldDefService, this.layoutExtension);
    } catch (error) {
      this.logger.warn(`Failed to seed fields for ${config.entityType}: ${(error as Error).message}`);
    }

    // 8. Seed workflows from fieldMeta
    try {
      await seedWorkflows(config, this.workflowRegistry);
    } catch (error) {
      this.logger.warn(`Failed to seed workflows for ${config.entityType}: ${(error as Error).message}`);
    }

    // 9. Register custom workflow guards from hooks
    if (config.hooks?.workflowGuards) {
      for (const [name, fn] of Object.entries(config.hooks.workflowGuards)) {
        this.workflowGuardRegistry.register(name, fn);
      }
    }

    this.logger.log(`Initialized entity: ${config.entityType} (/${config.slug})`);
  }
}
