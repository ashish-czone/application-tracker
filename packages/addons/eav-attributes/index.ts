// EAV Attributes — optional dynamic field storage extension
// Core types, helpers, field definitions, and layout are in @packages/entity-engine and @packages/entity-layout

import { EavAttributesModule } from './eav-attributes.module';

export { EavAttributesModule };
export const eavAttributesAddon = {
  module: EavAttributesModule,
  migration: '@packages/eav-attributes',
} as const;
export { FieldValueService } from './services/field-value.service';

// EAV-specific schemas
export { entityFieldValues } from './schema/entity-field-values';

// Re-exports for backward compatibility (canonical location is @packages/entity-engine)
export { FieldDefinitionService } from './services/field-definition.service';
export { LookupResolverService } from './services/lookup-resolver.service';
export { LayoutService } from './services/layout.service';
export { EAV_PERMISSIONS } from './permissions';

// Re-export types (canonical location is @packages/entity-engine)
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

export { FIELD_TYPE_TO_VALUE_COLUMN, RELATIONAL_FIELD_TYPES, FIELD_TYPE_REGISTRY } from './types';

// Re-export helpers (canonical location is @packages/entity-engine)
export { buildSnapshot, diffSnapshot } from './helpers/snapshot';
export { validatePayload } from './helpers/validate-payload';
export type { ValidationResult, ValidationError, ValidationOptions, FieldDefinitionWithOptions } from './helpers/validate-payload';
export { splitPayload } from './helpers/split-payload';
export type { SplitResult } from './helpers/split-payload';

// Re-export schemas (canonical locations are @packages/entity-engine and @packages/entity-layout)
export { fieldDefinitions } from './schema/field-definitions';
export { picklistOptions } from './schema/picklist-options';
export { layoutSections } from './schema/layout-sections';
export { layoutFields } from './schema/layout-fields';
