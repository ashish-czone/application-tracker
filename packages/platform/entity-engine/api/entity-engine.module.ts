import { Module, type DynamicModule, Logger, Inject, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter, EventRegistryService } from '@packages/events';
import { HierarchyService } from '@packages/hierarchy';
import { OrderableService } from '@packages/orderable';
import { RbacService, ScopeResolverRegistry } from '@packages/rbac';
import { AppLoggerService } from '@packages/logger';
import { EntityCoreModule } from './entity-core.module';
import { EntityRegistryService } from './entity-registry.service';
import { EntityService } from './entity.service';
import { FieldDefinitionService } from './services/field-definition.service';
import { FieldTypeSaveHookRegistry } from './services/field-type-save-hook.registry';
import { LookupResolverService } from './services/lookup-resolver.service';

import { createEntityController } from './create-entity-controller';
import { JsonbStorageAdapter } from './storage/jsonb-storage.adapter';
import { EAV_STORAGE_EXTENSION, type EavStorageExtension } from './extensions/eav-storage.interface';
import { MULTI_VALUE_EXTENSION, type MultiValueExtension } from './extensions/multi-value-extension.interface';
import { WORKFLOW_EXTENSION, type WorkflowExtension } from './extensions/workflow-extension.interface';
import { AUTOMATIONS_EXTENSION, type AutomationsExtension, type EntityResolverFieldConfig } from './extensions/automations-extension.interface';
import { AUDIT_EXTENSION, type AuditExtension } from './extensions/audit-extension.interface';
import { TAXONOMY_EXTENSION, type TaxonomyExtension } from './extensions/taxonomy-extension.interface';
import type { EntityConfig, FieldType } from './types';

/** Map entity-engine FieldType → EntityResolverFieldConfig type for the resolver registry */
type ResolverFieldType = EntityResolverFieldConfig['type'];
const FIELD_TYPE_MAP: Partial<Record<FieldType, ResolverFieldType>> = {
  text: 'text', email: 'text', phone: 'text', url: 'text',
  textarea: 'text', rich_text: 'text', auto_number: 'text',
  number: 'number', currency: 'number', decimal: 'number',
  date: 'date', datetime: 'date',
  boolean: 'boolean',
  picklist: 'enum', multi_select: 'enum', workflow: 'enum',
  lookup: 'uuid', user: 'uuid', category: 'uuid',
};

function mapFieldType(fieldType?: FieldType): ResolverFieldType | undefined {
  if (!fieldType) return undefined;
  return FIELD_TYPE_MAP[fieldType];
}

// Collect configs that need initialization — populated by forEntity(),
// drained by EntityEngineModule.onApplicationBootstrap. Module-level static
// so it's shared across every ModuleRef Nest creates for forEntity() entries.
const pendingConfigs: EntityConfig[] = [];

/**
 * Core entity engine module.
 *
 * Imports `EntityCoreModule` for the singleton state services (registry,
 * field defs, lookup resolver, seed service). Each `forEntity()` call adds
 * a per-entity controller and service token to the dynamic module — the
 * shared singletons stay singletons because Nest deduplicates the
 * `EntityCoreModule` import across all ModuleRefs.
 *
 * Usage:
 * ```
 * @Module({
 *   imports: [
 *     EntityEngineModule.forEntity(candidatesConfig),     // per entity
 *     EavAttributesModule,                                // optional: dynamic fields
 *     EntityLayoutModule,                                 // optional: layout customization
 *   ],
 * })
 * ```
 */
@Module({
  imports: [EntityCoreModule],
})
export class EntityEngineModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('EntityEngineModule');

  constructor(
    private readonly registry: EntityRegistryService,
    private readonly rbac: RbacService,
    private readonly eventRegistry: EventRegistryService,
    private readonly lookupResolver: LookupResolverService,
    private readonly fieldDefService: FieldDefinitionService,
    @Inject(WORKFLOW_EXTENSION) @Optional() private readonly workflowExt: WorkflowExtension | null,
    @Inject(AUTOMATIONS_EXTENSION) @Optional() private readonly automationsExt: AutomationsExtension | null,
    @Inject(AUDIT_EXTENSION) @Optional() private readonly auditExt: AuditExtension | null,
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
            jsonbStorage: JsonbStorageAdapter,
            multiValueExtension: MultiValueExtension | null,
            fieldDefinitionService: FieldDefinitionService,
            lookupResolver: LookupResolverService,
            taxonomyExt: TaxonomyExtension | null,
            hookRegistry: FieldTypeSaveHookRegistry,
            workflowExt: WorkflowExtension | null,
            entityRegistry: EntityRegistryService,
            appLogger: AppLoggerService,
            scopeResolverRegistry: ScopeResolverRegistry,
            hierarchyService: HierarchyService | null,
            orderableService: OrderableService | null,
          ) => {
            let storage: EavStorageExtension | null = null;
            if (config.customFields === 'eav') {
              if (!eavStorage) {
                throw new Error(
                  `Entity '${config.entityType}' requests customFields: 'eav' but EavAttributesModule is not loaded.`,
                );
              }
              storage = eavStorage;
            } else if (config.customFields === true) {
              storage = jsonbStorage;
            }
            return new EntityService(config, database, domainEventEmitter, storage, multiValueExtension, fieldDefinitionService, lookupResolver, taxonomyExt, hookRegistry, workflowExt, entityRegistry, appLogger, scopeResolverRegistry, hierarchyService, orderableService);
          },
          inject: [DatabaseService, DomainEventEmitter, { token: EAV_STORAGE_EXTENSION, optional: true }, JsonbStorageAdapter, { token: MULTI_VALUE_EXTENSION, optional: true }, FieldDefinitionService, LookupResolverService, { token: TAXONOMY_EXTENSION, optional: true }, FieldTypeSaveHookRegistry, { token: WORKFLOW_EXTENSION, optional: true }, EntityRegistryService, AppLoggerService, ScopeResolverRegistry, { token: HierarchyService, optional: true }, { token: OrderableService, optional: true }],
        },
      ],
      exports: [serviceToken],
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    while (pendingConfigs.length > 0) {
      const config = pendingConfigs.shift()!;
      await this.initializeEntity(config);
    }
    // Resolve `extensionOf` configs once every entity is registered. Throws
    // on the first invalid extension so misconfigurations fail at boot.
    this.registry.finalize();
  }

  private async initializeEntity(config: EntityConfig): Promise<void> {
    // 1. Register in entity registry
    this.registry.register(config);

    // 1b. For non-admin-configurable entities, mirror code-defined fields into
    //     the FieldDefinitionService cache so readers don't have to branch on
    //     the flag — no DB rows exist for these entities.
    if (!config.adminConfigurable) {
      this.fieldDefService.populateFromRegistry(config);
    }

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

    // 4. Audit (if available)
    if (this.auditExt) {
      this.auditExt.register(config.entityType, {
        events: [createdEvent, updatedEvent, deletedEvent, ...transitionEvents],
      });
    }

    // 5. Entity resolver (automations — schedule triggers + condition builder)
    if (this.automationsExt) {
      const resolverFields: Record<string, EntityResolverFieldConfig> = {};
      for (const [key, meta] of Object.entries(config.fieldMeta)) {
        const mapped = mapFieldType(meta.fieldType);
        if (!mapped) continue;
        const fieldConfig: EntityResolverFieldConfig = { type: mapped, label: meta.label };
        if (meta.fieldType === 'picklist' || meta.fieldType === 'multi_select') {
          if (meta.picklistOptions) {
            fieldConfig.options = meta.picklistOptions.map((o) => o.value);
          } else {
            const fieldKey = key;
            fieldConfig.resolveOptions = async () => {
              const defs = await this.fieldDefService.listByEntity(config.entityType);
              const def = defs.find((d: { fieldKey: string }) => d.fieldKey === fieldKey);
              if (!def) return [];
              const opts = await this.fieldDefService.getPicklistOptions(def.id);
              return opts.map((o) => o.value);
            };
          }
        }
        if (meta.fieldType === 'workflow' && meta.workflow) {
          fieldConfig.options = meta.workflow.states.map((s) => s.name);
        }
        resolverFields[key] = fieldConfig;
      }
      this.automationsExt.registerEntityResolver(config.entityType, {
        table: config.table,
        fields: resolverFields,
        userFields: config.recipientFields ?? {},
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

    // 7. Register custom workflow guards from hooks (in-memory; DB workflow rows
    //    are seeded by EntityEngineSeedService via the db:seed:system CLI).
    if (this.workflowExt && config.hooks?.workflowGuards) {
      for (const [name, fn] of Object.entries(config.hooks.workflowGuards)) {
        this.workflowExt.registerGuard(name, fn);
      }
    }

    this.logger.log(`Initialized entity: ${config.entityType} (/${config.slug})`);
  }
}
