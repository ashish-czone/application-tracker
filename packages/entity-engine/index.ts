export { EntityEngineModule } from './entity-engine.module';
export { EntityRegistryService } from './entity-registry.service';
export { EntityService } from './entity.service';
export { EntityEngineApiController } from './entity-engine-api.controller';
export { createEntityController } from './create-entity-controller';
export { createFieldPermissionInterceptor } from './interceptors/field-permission.interceptor';
export { seedEntityFields, seedWorkflows } from './seed-entity-fields';

// --- Types originally from entity-engine ---

export type {
  EntityConfig,
  EntityHooks,
  EntityRelationship,
  EntityUIHints,
  EntityRegistryEntry,
  EntityAction,
  EntityActions,
  ListLayoutColumn,
  ListLayoutResponse,
  BaseListQuery,
  FieldMeta,
  WorkflowFieldConfig,
  WorkflowStateDef,
  WorkflowTransitionDef,
  WorkflowTargetDef,
} from './types';

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
  FullLayout,
  FilterOperator,
  FieldFilter,
  LookupConfig,
  LookupResult,
  RegisterFieldInput,
  SeedSectionInput,
  SetPicklistOptionInput,
  FieldTypeRegistryEntry,
} from './types';

export {
  FIELD_TYPE_TO_VALUE_COLUMN,
  RELATIONAL_FIELD_TYPES,
  FIELD_TYPE_REGISTRY,
} from './types';
