/**
 * Registers core field types in the global registry.
 * Import this file at the top of test files that depend on the field type registry.
 *
 * Only registers entity-engine's own core field types — plugin field types
 * (eav-attributes, taxonomy, workflows) are tested at the app level where
 * all packages are available.
 */
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '../field-types';

if (!fieldTypeRegistry.has('text')) {
  fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
}
