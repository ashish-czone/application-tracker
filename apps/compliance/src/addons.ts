import { ConfigService } from '@nestjs/config';
import { attachmentsAddon } from '@packages/attachments';
import { automationsAddon } from '@packages/automations';
import { directoryAddon } from '@packages/directory';
import { documentTemplatesAddon } from '@packages/document-templates';
import { eavAttributesAddon } from '@packages/eav-attributes';
import { entityRelationsAddon } from '@packages/entity-relations';
import { evaluationsAddon } from '@packages/evaluations';
import { hierarchyAddon } from '@packages/hierarchy';
import { notesAddon } from '@packages/notes';
import { orgUnitsAddon } from '@packages/org-units';
import { taxonomyAddon } from '@packages/taxonomy';
import { tenancyAddon, type TenancyMode, type TenantResolver } from '@packages/tenancy';
import { workflowsAddon } from '@packages/workflows';
import type { Addon } from '@packages/app-shell';

/**
 * Addons this app uses. Same array consumed by:
 *   - createAppModule({ addons }) in app.module.ts → wires the modules
 *   - runAppMigrations({ addons }) in cli/migrate.ts → applies migrations
 *   - the compliance-api integration test global-setup (mirrored)
 *
 * Notes on this app's specifics:
 * - tenancy is conditional on TENANCY_MODE
 * - org-units is library-shape: the app's wrapper lives in extraImports
 */
const tenancyAddons: readonly Addon[] = process.env.TENANCY_MODE
  ? [
      tenancyAddon({
        useFactory: (config: ConfigService) => ({
          mode: config.get<string>('TENANCY_MODE') as TenancyMode,
          resolver: (config.get<string>('TENANCY_RESOLVER') ?? 'header') as TenantResolver,
          headerName: config.get<string>('TENANCY_HEADER'),
          controlPlaneUrl: config.get<string>('CONTROL_PLANE_URL'),
        }),
        inject: [ConfigService],
      }),
    ]
  : [];

export const complianceAddons: readonly Addon[] = [
  // automations + workflows first — compliance domain entities (rules,
  // filings) attach workflows and FK to workflow_definitions.
  automationsAddon,
  workflowsAddon,
  // directory before any compliance migration that ALTERs `clients` /
  // `client_contacts` (the shared identity tables) — directory creates them.
  directoryAddon,
  ...tenancyAddons,
  attachmentsAddon,
  documentTemplatesAddon(),
  eavAttributesAddon,
  entityRelationsAddon,
  evaluationsAddon,
  hierarchyAddon,
  notesAddon,
  orgUnitsAddon,
  taxonomyAddon,
];
