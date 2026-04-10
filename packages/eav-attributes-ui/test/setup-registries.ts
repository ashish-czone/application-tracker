/**
 * Registers field type definitions for tests.
 * Uses minimal stubs for React components since tests only need zodSchema.
 */
import { fieldTypeRegistry } from '@packages/field-types';
import { fieldTypeUIRegistry, zodSchemas } from '@packages/field-types/ui';
import { coreFieldTypesPlugin } from '@packages/entity-engine/field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';

// Register core field type definitions (storage, validation, etc.)
if (!fieldTypeRegistry.has('text')) {
  fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
  fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
}

// Register UI definitions (zodSchema only — React components are stubs)
if (!fieldTypeUIRegistry.has('text')) {
  const stub = (() => null) as any;
  const stubCell = () => '';

  fieldTypeUIRegistry.registerAll([
    { type: 'text',         FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.stringSchema },
    { type: 'email',        FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.emailSchema },
    { type: 'phone',        FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.stringSchema },
    { type: 'url',          FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.urlSchema },
    { type: 'textarea',     FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.stringSchema },
    { type: 'rich_text',    FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.stringSchema },
    { type: 'number',       FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.integerSchema },
    { type: 'currency',     FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.integerSchema },
    { type: 'decimal',      FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.decimalSchema },
    { type: 'date',         FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.dateSchema },
    { type: 'datetime',     FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.datetimeSchema },
    { type: 'boolean',      FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.booleanSchema },
    { type: 'picklist',     FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.uuidSchema },
    { type: 'multi_select', FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.arraySchema },
    { type: 'lookup',       FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.uuidSchema },
    { type: 'user',         FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.uuidSchema },
    { type: 'tags',         FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.arraySchema },
    { type: 'category',     FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.uuidSchema },
    { type: 'auto_number',  FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.noopSchema },
    { type: 'file',         FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.anySchema },
    { type: 'workflow',     FormComponent: stub, ViewComponent: stub, CellFormatter: stubCell, zodSchema: zodSchemas.noopSchema },
  ]);
}
