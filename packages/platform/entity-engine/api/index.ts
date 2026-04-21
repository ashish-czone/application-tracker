export { EntityEngineModule } from './entity-engine.module';
export { EntityRegistryService } from './entity-registry.service';
export { EntityService } from './entity.service';
export { EntityEngineApiController } from './entity-engine-api.controller';
export { CreateEntityAction } from './actions/create-entity.action';
export { UpdateEntityAction } from './actions/update-entity.action';
export { DeleteEntityAction } from './actions/delete-entity.action';
export { createEntityController } from './create-entity-controller';
export { createFieldPermissionInterceptor } from './interceptors/field-permission.interceptor';
export { seedEntityFields, seedWorkflows } from './seed-entity-fields';
export { defineEntity } from './define-entity';
export type { ModelDefinition, ModelField } from './define-entity';

// --- Types originally from entity-engine ---

export type {
  CustomFieldsMode,
  EntityConfig,
  EntityHooks,
  EntityRelationship,
  RelationHandler,
  RelationHandlerContext,
  ExtensionOfConfig,
  ResolvedExtension,
  EntityUIHints,
  EntityRegistryEntry,
  EntityAction,
  EntityActions,
  PickerConfig,
  ListLayoutColumn,
  ListLayoutResponse,
  BaseListQuery,
  FieldMeta,
  WorkflowFieldConfig,
  WorkflowStateDef,
  WorkflowTransitionDef,
  WorkflowTargetDef,
  ScopeResolver,
  DataAccessConfig,
  DataAccessContext,
  PositionScopeProvider,
} from './types';

export { POSITION_SCOPE_PROVIDER } from './types';

// --- Types and constants moved from eav-attributes ---

export type {
  FieldType,
  EavValueColumn,
  FieldDefinition,
  PicklistOption,
  LayoutSection,
  LayoutField,
  FullLayoutField,
  FullLayoutSection,
  FullLayoutRelationSection,
  FullLayout,
  NestedRelationshipField,
  FilterOperator,
  FieldFilter,
  LookupConfig,
  LookupResult,
  RegisterFieldInput,
  SeedSectionInput,
  SetPicklistOptionInput,
  FieldTypeRegistryEntry,
} from './types';

/** @deprecated Use fieldTypeRegistry from @packages/field-types instead */
export {
  FIELD_TYPE_TO_VALUE_COLUMN,
  RELATIONAL_FIELD_TYPES,
  FIELD_TYPE_REGISTRY,
} from './types';

// Re-export field type registry as the canonical API
export { fieldTypeRegistry } from '@packages/field-types';
export { coreFieldTypesPlugin } from './field-types';

// --- Helpers moved from eav-attributes ---

export { buildSnapshot, diffSnapshot } from './helpers/snapshot';

export { validatePayload } from './helpers/validate-payload';
export type { ValidationResult, ValidationError, ValidationOptions, FieldDefinitionWithOptions } from './helpers/validate-payload';

export { splitPayload } from './helpers/split-payload';
export type { SplitResult } from './helpers/split-payload';

export { customFieldsColumn, hasCustomFieldsColumn } from './helpers/custom-fields-column';
export { JsonbStorageAdapter } from './storage/jsonb-storage.adapter';
export {
  generateJsonbIndexesForEntity,
  generateJsonbIndexes,
} from './helpers/generate-jsonb-indexes';
export type { JsonbIndexStatement } from './helpers/generate-jsonb-indexes';

// --- Schemas moved from eav-attributes ---

export { fieldDefinitions } from './schema/field-definitions';
export { picklistOptions } from './schema/picklist-options';

// --- Services moved from eav-attributes ---

export { FieldDefinitionService } from './services/field-definition.service';
export { EntityDefinitionService } from './services/entity-definition.service';
export { LookupResolverService } from './services/lookup-resolver.service';
export { EntityEngineSeedService } from './services/entity-engine-seed.service';
export {
  buildInMemoryFields,
  buildInMemoryLayout,
  buildRelationshipLayoutSections,
  synthesizeNestedField,
} from './helpers/build-in-memory-definitions';

// --- Controllers moved from eav-attributes ---

export { FieldsController } from './controllers/fields.controller';
export { LookupsController } from './controllers/lookups.controller';

// --- Permissions ---

export { EAV_PERMISSIONS } from './permissions';

// --- Extension interfaces ---

export type { EavStorageExtension } from './extensions/eav-storage.interface';
export { EAV_STORAGE_EXTENSION } from './extensions/eav-storage.interface';

export type { MultiValueExtension } from './extensions/multi-value-extension.interface';
export { MULTI_VALUE_EXTENSION } from './extensions/multi-value-extension.interface';

// --- Field type save hooks ---

export { FieldTypeSaveHookRegistry, fieldTypeSaveHookRegistry } from './services/field-type-save-hook.registry';
export type {
  FieldTypeSaveHookContext,
  FieldTypeSaveHookResult,
  FieldTypeSaveHooks,
  OnBeforeSaveHook,
  OnTransactionalSaveHook,
  OnAfterSaveHook,
} from './services/field-type-save-hook.registry';

export type { LayoutExtension } from './extensions/layout-extension.interface';
export { LAYOUT_EXTENSION } from './extensions/layout-extension.interface';

export type { WorkflowExtension, WorkflowDefinitionRef, WorkflowTransitionRef, ValidatedTransition, WorkflowGuardContext, WorkflowGuardFn } from './extensions/workflow-extension.interface';
export { WORKFLOW_EXTENSION } from './extensions/workflow-extension.interface';

export type { AutomationsExtension, ActionHandlerDef, ActionExecutionContext, ActionExecutionResult, EntityResolverConfig, EntityResolverFieldConfig } from './extensions/automations-extension.interface';
export { AUTOMATIONS_EXTENSION } from './extensions/automations-extension.interface';

export type { AuditExtension } from './extensions/audit-extension.interface';
export { AUDIT_EXTENSION } from './extensions/audit-extension.interface';

export type { TaxonomyExtension, TagRef } from './extensions/taxonomy-extension.interface';
export { TAXONOMY_EXTENSION } from './extensions/taxonomy-extension.interface';

