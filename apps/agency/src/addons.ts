import { contentAddon } from '@packages/content-api';
import { hierarchyAddon } from '@packages/hierarchy';
import { mediaLibraryAddon } from '@packages/media-library-api';
import { taxonomyAddon } from '@packages/taxonomy';
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
  taxonomyAddon,
  hierarchyAddon,
  contentAddon,
  mediaLibraryAddon,
];
