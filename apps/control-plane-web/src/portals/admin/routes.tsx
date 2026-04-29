import { useMemo } from 'react';
import { RolesListPage as BaseRolesListPage, type RbacEntity } from '@packages/rbac-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { SettingsPage as AppSettingsPage } from '@packages/settings-ui';

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

export { RolesListPage, AppSettingsPage };
