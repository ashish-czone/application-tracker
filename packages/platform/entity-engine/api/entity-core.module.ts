import { Module, Global, Logger, Inject, Optional, type OnModuleInit } from '@nestjs/common';
import { RbacService, FIELD_PERMISSION_ENTITY_RESOLVER, FieldPermissionsController } from '@packages/rbac';
import type { FieldPermissionEntityResolver } from '@packages/rbac';
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from './field-types';
import { EntityRegistryService } from './entity-registry.service';
import { EntityEngineApiController } from './entity-engine-api.controller';
import { FieldsController } from './controllers/fields.controller';
import { LookupsController } from './controllers/lookups.controller';
import { FieldDefinitionService } from './services/field-definition.service';
import { LookupResolverService } from './services/lookup-resolver.service';
import { EntityEngineSeedService } from './services/entity-engine-seed.service';
import { FieldTypeSaveHookRegistry, fieldTypeSaveHookRegistry } from './services/field-type-save-hook.registry';
import { CreateEntityAction } from './actions/create-entity.action';
import { UpdateEntityAction } from './actions/update-entity.action';
import { DeleteEntityAction } from './actions/delete-entity.action';
import { AUTOMATIONS_EXTENSION, type AutomationsExtension } from './extensions/automations-extension.interface';

/**
 * Owns the singleton state for the entity engine.
 *
 * Why this exists: `EntityEngineModule.forEntity()` returns a DynamicModule
 * with `module: EntityEngineModule`, so each call produces a separate
 * ModuleRef. Providers declared on the static `@Module()` decorator are
 * instantiated per ModuleRef, which means stateful services like
 * `EntityRegistryService` end up duplicated — `register()` mutates one
 * instance while consumers (e.g. `EntityEngineSeedService`) inject a
 * different empty one.
 *
 * Putting these providers in a separate, non-dynamic, `@Global()` module
 * lets Nest deduplicate the import across every `forEntity()` registration,
 * giving us a single shared instance regardless of how many entities are
 * registered.
 */
@Global()
@Module({
  controllers: [
    EntityEngineApiController,
    FieldPermissionsController,
    FieldsController,
    LookupsController,
  ],
  providers: [
    EntityRegistryService,
    FieldDefinitionService,
    LookupResolverService,
    EntityEngineSeedService,
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
    { provide: 'FIELD_DEFINITION_SERVICE', useExisting: FieldDefinitionService },
    CreateEntityAction,
    UpdateEntityAction,
    DeleteEntityAction,
  ],
  exports: [
    EntityRegistryService,
    FieldDefinitionService,
    LookupResolverService,
    EntityEngineSeedService,
    FieldTypeSaveHookRegistry,
    FIELD_PERMISSION_ENTITY_RESOLVER,
    'FIELD_DEFINITION_SERVICE',
  ],
})
export class EntityCoreModule implements OnModuleInit {
  private readonly logger = new Logger('EntityCoreModule');

  constructor(
    private readonly rbac: RbacService,
    @Inject(AUTOMATIONS_EXTENSION) @Optional() private readonly automationsExt: AutomationsExtension | null,
    private readonly createEntityAction: CreateEntityAction,
    private readonly updateEntityAction: UpdateEntityAction,
    private readonly deleteEntityAction: DeleteEntityAction,
  ) {}

  onModuleInit(): void {
    if (!fieldTypeRegistry.has('text')) {
      fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
    }

    this.rbac.registerPermissions('eav', [
      { action: 'read', description: 'View field definitions and layouts' },
      { action: 'manage', description: 'Create/update/delete custom fields and layouts' },
    ]);

    if (this.automationsExt) {
      this.automationsExt.registerAction(this.createEntityAction);
      this.automationsExt.registerAction(this.updateEntityAction);
      this.automationsExt.registerAction(this.deleteEntityAction);
    }
  }
}
