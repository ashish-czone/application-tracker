/**
 * Registers core field types in the global registry for tests.
 */
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '@packages/entity-engine/field-types';
import { eavFieldTypesPlugin } from '../field-types';

if (!fieldTypeRegistry.has('text')) {
  fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
  fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
}
