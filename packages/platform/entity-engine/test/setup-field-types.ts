/**
 * Registers all field types in the global registry.
 * Import this file at the top of test files that depend on the field type registry.
 */
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '../field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';
import { taxonomyFieldTypesPlugin } from '@packages/taxonomy/field-types';
import { workflowFieldTypesPlugin } from '@packages/workflows/field-types';

if (!fieldTypeRegistry.has('text')) {
  fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
  fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
  fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
  fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);
}
