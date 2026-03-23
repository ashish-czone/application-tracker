export { EavAttributesModule } from './eav-attributes.module';
export { FieldDefinitionService } from './services/field-definition.service';
export { LayoutService } from './services/layout.service';
export { FieldValueService } from './services/field-value.service';
export { LookupResolverService } from './services/lookup-resolver.service';

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
} from './types';

export { FIELD_TYPE_TO_VALUE_COLUMN, RELATIONAL_FIELD_TYPES } from './types';

export { buildSnapshot, diffSnapshot } from './helpers/snapshot';

export { validatePayload } from './helpers/validate-payload';
export type { ValidationResult, ValidationError, ValidationOptions, FieldDefinitionWithOptions } from './helpers/validate-payload';

export { splitPayload } from './helpers/split-payload';
export type { SplitResult } from './helpers/split-payload';

export {
  fieldDefinitions,
  picklistOptions,
  layoutSections,
  layoutFields,
  entityFieldValues,
} from './schema';
