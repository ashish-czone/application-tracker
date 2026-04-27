import { automationsAddon } from '@packages/automations';
import { contentAddon } from '@packages/content-api';
import { hierarchyAddon } from '@packages/hierarchy';
import { mediaLibraryAddon } from '@packages/media-library-api';
import { taxonomyAddon } from '@packages/taxonomy';
import { workflowsAddon } from '@packages/workflows';
import type { Addon } from '@packages/app-shell';

/**
 * Addons this app uses. The same array is consumed by:
 *   - createAppModule({ addons }) in app.module.ts → wires the modules
 *   - runAppMigrations({ addons }) in cli/migrate.ts → applies migrations
 *   - the agency-api integration test global-setup
 *
 * Add or remove an entry here and both sites update automatically — that's
 * the whole point of the Addon shape.
 */
export const agencyAddons: readonly Addon[] = [
  // Order: workflows + automations first — addons that attach a workflow
  // to their entity (e.g. tasks status fields in projects domain) reference
  // workflow_definitions, so those tables must exist first.
  automationsAddon,
  workflowsAddon,
  taxonomyAddon,
  hierarchyAddon,
  contentAddon,
  mediaLibraryAddon,
];
