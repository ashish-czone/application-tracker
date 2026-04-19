/**
 * Registers UI definitions for multi_user and multi_lookup field types.
 * Import this file at app startup alongside eav-attributes-ui/register-all.
 */
import { fieldTypeUIRegistry, zodSchemas } from '@packages/field-types/ui';
import { MultiLookupForm, multiLookupView, multiLookupCell } from './multi-lookup';

export function registerEntityRelationsFieldTypes() {
  fieldTypeUIRegistry.registerAll([
    { type: 'multi_lookup', FormComponent: MultiLookupForm, ViewComponent: multiLookupView, CellFormatter: multiLookupCell, zodSchema: zodSchemas.arraySchema },
    { type: 'multi_user',   FormComponent: MultiLookupForm, ViewComponent: multiLookupView, CellFormatter: multiLookupCell, zodSchema: zodSchemas.arraySchema },
  ]);
}
