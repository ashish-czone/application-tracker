import { ConfigService } from '@nestjs/config';
import { attachmentsAddon } from '@packages/attachments';
import { automationsAddon } from '@packages/automations';
import { documentTemplatesAddon } from '@packages/document-templates';
import { eavAttributesAddon } from '@packages/eav-attributes';
import { entityRelationsAddon } from '@packages/entity-relations';
import { evaluationsAddon } from '@packages/evaluations';
import { hierarchyAddon } from '@packages/hierarchy';
import { notesAddon } from '@packages/notes';
import { orgUnitsAddon } from '@packages/org-units';
import { tasksAddon } from '@packages/tasks';
import { taxonomyAddon } from '@packages/taxonomy';
import { tenancyAddon, type TenancyMode, type TenantResolver } from '@packages/tenancy';
import { workflowsAddon } from '@packages/workflows';
import type { Addon } from '@packages/app-shell';

/**
 * Addons this app uses. Same array consumed by:
 *   - createAppModule({ addons }) in app.module.ts → wires the modules
 *   - runAppMigrations({ addons }) in cli/migrate.ts → applies migrations
 *
 * Add or remove an entry here and both sites update automatically.
 *
 * Notes on this app's specifics:
 * - tenancy is conditional on TENANCY_MODE; when off, neither the
 *   tables nor the module are needed.
 * - tasks ships migration-only — recruit's demo seed uses the schema
 *   but the app does not load TasksModule.
 * - org-units is library-shape: the app's own OrgUnitsModule wrapper
 *   lives in extraImports; the addon below carries only the migration.
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

export const recruitAddons: readonly Addon[] = [
  // automations + workflows first — entity tables that attach a workflow
  // (e.g. tasks status, applications stage) FK to workflow_definitions.
  automationsAddon,
  workflowsAddon,
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
  tasksAddon,
];
