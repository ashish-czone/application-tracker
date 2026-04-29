import { useMemo } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/taxonomy-ui';
import { RolesListPage as BaseRolesListPage, type RbacEntity } from '@packages/rbac-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { AutomationsPage, RuleBuilderPage } from '@packages/automations-ui';
import { WorkflowsListPage, WorkflowEditorPage } from '@packages/workflows-ui';
import { SettingsPage } from '@packages/settings-ui';
import { OrgPositionsPage } from '@packages/org-units-ui';
import { OrgUnitsPage } from '@packages/org-units-ui';

/**
 * Adapter that bridges this portal's entity-engine registry into the
 * implementation-agnostic shape `@packages/rbac-ui` expects. Keeps rbac-ui
 * free of any direct entity-engine dependency.
 */
function RolesListPage() {
  const { entities } = useEntityEngine();
  const rbacEntities = useMemo<RbacEntity[]>(
    () => entities.map((e) => ({
      entityType: e.entityType,
      pluralName: e.pluralName,
      navOrder: e.ui?.navOrder,
    })),
    [entities],
  );
  return <BaseRolesListPage entities={rbacEntities} />;
}

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, WorkflowsListPage, WorkflowEditorPage, SettingsPage, OrgPositionsPage, OrgUnitsPage };
