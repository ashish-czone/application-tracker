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

export { FIELD_TYPE_TO_VALUE_COLUMN } from './types';

export {
  fieldDefinitions,
  picklistOptions,
  layoutSections,
  layoutFields,
  entityFieldValues,
} from './schema';
