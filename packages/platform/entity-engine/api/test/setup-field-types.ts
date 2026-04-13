/**
 * Registers field types in the global registry for unit tests.
 * Loaded via vitest.config.ts setupFiles.
 */
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '../field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';

if (!fieldTypeRegistry.has('text')) {
  fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
  fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
}
