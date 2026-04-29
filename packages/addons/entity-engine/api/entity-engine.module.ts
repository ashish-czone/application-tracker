import { Module, type DynamicModule, Logger, Inject, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter, EventRegistryService } from '@packages/events';
import { RbacService, ScopeResolverRegistry } from '@packages/rbac';
import { AppLoggerService } from '@packages/logger';
import { EntityCoreModule } from './entity-core.module';
import { EntityRegistryService, type RegisteredEntityConfig } from './entity-registry.service';
import { EntityService } from './entity.service';
import { deriveSupportedScopes } from './helpers/derive-supported-scopes';
import { ensureRegisteredIdentity } from './helpers/registered-identity';
import {
  registerEntityCrudPermissions,
  registerEntityCrudEvents,
  registerWorkflowTransitionEvent,
  registerEntityAudit,
  registerEntityLookup,
} from './helpers/entity-registrations';
import { FieldDefinitionService } from './services/field-definition.service';
import { LookupResolverService } from './services/lookup-resolver.service';

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
 * a per-entity service token to the dynamic module — the shared singletons
 * stay singletons because Nest deduplicates the `EntityCoreModule` import
 * across all ModuleRefs. HTTP surface is owned by a hand-written controller
 * in the consuming module that injects `ENTITY_SERVICE_<entityType>`.
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
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
    @Inject(WORKFLOW_EXTENSION) @Optional() private readonly workflowExt: WorkflowExtension | null,
    @Inject(AUTOMATIONS_EXTENSION) @Optional() private readonly automationsExt: AutomationsExtension | null,
    @Inject(AUDIT_EXTENSION) @Optional() private readonly auditExt: AuditExtension | null,
  ) {}

  /**
   * Register a single entity with the engine.
   *
   * Produces the `ENTITY_SERVICE_<entityType>` provider, queues the config
   * for bootstrap (RBAC manifests, event registry, seeding), and exports
   * the service token. The HTTP surface is always owned by a hand-written
   * controller in the consuming module — import the dynamic module and add
   * a `@Controller()` class that injects `ENTITY_SERVICE_<entityType>`.
   */
  static forEntity(config: EntityConfig): DynamicModule {
    const serviceToken = `ENTITY_SERVICE_${config.entityType}`;

    // Queue config for initialization (happens in onApplicationBootstrap)
    pendingConfigs.push(config);

    return {
      module: EntityEngineModule,
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
            workflowExt: WorkflowExtension | null,
            entityRegistry: EntityRegistryService,
            appLogger: AppLoggerService,
            scopeResolverRegistry: ScopeResolverRegistry,
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
            // The forEntity factory runs at DI-resolution time, before
            // onApplicationBootstrap registers entities. EntityService needs
            // a populated identity (singularName / pluralName) for log and
            // exception messages, so apply the same fallback here that the
            // registry will apply on register(). Safe to mutate: the same
            // object reference is passed to the registry later.
            ensureRegisteredIdentity(config);
            return new EntityService(config as RegisteredEntityConfig, database, domainEventEmitter, storage, multiValueExtension, fieldDefinitionService, lookupResolver, taxonomyExt, workflowExt, entityRegistry, appLogger, scopeResolverRegistry);
          },
          inject: [DatabaseService, DomainEventEmitter, { token: EAV_STORAGE_EXTENSION, optional: true }, JsonbStorageAdapter, { token: MULTI_VALUE_EXTENSION, optional: true }, FieldDefinitionService, LookupResolverService, { token: TAXONOMY_EXTENSION, optional: true }, { token: WORKFLOW_EXTENSION, optional: true }, EntityRegistryService, AppLoggerService, ScopeResolverRegistry],
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
    // Resolve every entity's search/sort field keys to Drizzle columns now
    // that all entities are registered. Throws on the first unknown key so
    // misconfigurations fail at boot.
    this.registry.finalize();
  }

  private async initializeEntity(config: EntityConfig): Promise<void> {
    // 1. Register in entity registry. After this call, the registry has
    //    populated singularName / pluralName from a slug-derived fallback if
    //    the input config omitted them — read the registered form back so
    //    the rest of this method sees the populated identity strings.
    this.registry.register(config);
    const registered = this.registry.getOrFail(config.entityType);

    // 1b. For non-admin-configurable entities, mirror code-defined fields into
    //     the FieldDefinitionService cache so readers don't have to branch on
    //     the flag — no DB rows exist for these entities.
    if (!config.adminConfigurable) {
      this.fieldDefService.populateFromRegistry(config);
    }

    // 2. RBAC — register permission manifests. `supportedScopes` per permission
    //    is derived from the entity's declared anchors + registered scope
    //    resolvers (opt-in per entity) + inline entity scopes. extraPermissions
    //    may override with a narrower subset (e.g. `pickup` only makes sense
    //    on `unit` / `unassigned_in_unit`, not on `own`).
    const derivedScopes = deriveSupportedScopes(config, this.scopeResolverRegistry.values());
    const plural = registered.pluralName.toLowerCase();
    const singular = registered.singularName.toLowerCase();
    registerEntityCrudPermissions(this.rbac, {
      slug: config.slug,
      singular,
      plural,
      supportedScopes: derivedScopes,
      extraPermissions: config.extraPermissions,
    });

    // 3. Events — standard CRUD + one event per workflow field.
    const { created: createdEvent, updated: updatedEvent, deleted: deletedEvent } =
      registerEntityCrudEvents(this.eventRegistry, {
        entityType: config.entityType,
        singular,
      });

    const transitionEvents: string[] = [];
    for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
      if (meta.fieldType !== 'workflow') continue;
      const eventName = registerWorkflowTransitionEvent(this.eventRegistry, {
        entityType: config.entityType,
        fieldKey,
        singular,
        fieldLabel: meta.label,
      });
      transitionEvents.push(eventName);
    }

    // 4. Audit (if available)
    registerEntityAudit(this.auditExt, {
      entityType: config.entityType,
      eventNames: [createdEvent, updatedEvent, deletedEvent, ...transitionEvents],
    });

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
      registerEntityLookup(this.lookupResolver, {
        entityType: config.entityType,
        table: config.table,
        labelField: config.lookup.labelField,
        searchFields: config.lookup.searchFields,
      });
    }

    this.logger.log(`Initialized entity: ${config.entityType} (/${config.slug})`);
  }
}
