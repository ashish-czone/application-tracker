// Re-export all types and constants from entity-engine (canonical location).
// Uses direct file import to avoid pulling in the full entity-engine barrel (which has heavy NestJS deps).
export type {
  FieldType,
  EavValueColumn,
  FieldTypeRegistryEntry,
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
} from '@packages/entity-engine/types';

export {
  RELATIONAL_FIELD_TYPES,
  FIELD_TYPE_TO_VALUE_COLUMN,
  FIELD_TYPE_REGISTRY,
} from '@packages/entity-engine/types';
