import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '@packages/entity-engine/field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';
import { taxonomyFieldTypesPlugin } from '@packages/taxonomy/field-types';
import { workflowFieldTypesPlugin } from '@packages/workflows/field-types';

fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);

import '@packages/eav-attributes-ui/field-types/register-all';
import { registerEntityRelationsFieldTypes } from '@packages/entity-relations-ui';
import { registerRatingFieldType } from '@packages/evaluations-ui';
registerEntityRelationsFieldTypes();
registerRatingFieldType();

// Dashboard widgets: each contributing package registers its own widgets
// with @packages/dashboard-ui's registry at bootstrap.
import '@packages/notification-channels-ui/register-widgets';
import '@packages/tasks-ui/register-widgets';
import '@domains/compliance-ui/register-widgets';

import { WebShell } from '@packages/app-shell-ui';
import { DebugProfilerBar, DebugProfilerProvider } from '@packages/debug-profiler-ui';
import { TASKS_UI_CONFIG, TaskAssigneeCell } from '@packages/tasks-ui';
import { USERS_UI_CONFIG } from '@packages/users-ui';
import { OrgUnitsPage, OrgPositionsPage } from '@packages/org-units-ui';
import { notesDetailTab, notesSidebarPanel } from '@packages/notes-ui';
import { attachmentsDetailTab, attachmentsSidebarPanel } from '@packages/attachments-ui';
import { evaluationsDetailTab, evaluationsSidebarPanel } from '@packages/evaluations-ui';
import { taxonomyWeb } from '@packages/taxonomy-ui';
import { workflowsWeb } from '@packages/workflows-ui';
import { automationsWeb } from '@packages/automations-ui';
import { AuditTimeline } from '@packages/audit-ui';
import { AvatarNameCell } from '@packages/ui';
import { CheckSquare, Building2, UserCog } from 'lucide-react';
import type { MenuItem } from '@packages/domains';
import { complianceWeb } from '@domains/compliance-ui';
import { api } from './lib/api';
import './globals.css';

const addonMenuItems: MenuItem[] = [
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, position: 'after' },
  { path: '/org-units', label: 'Org Structure', icon: Building2, permission: 'org-units.read', position: 'after' },
  { path: '/org-positions', label: 'Org Positions', icon: UserCog, permission: 'org-units.read', position: 'after' },
];

const addonRoutes = [
  { path: '/org-units', element: <OrgUnitsPage /> },
  { path: '/org-positions', element: <OrgPositionsPage /> },
];

const detailTabs = [
  notesDetailTab,
  attachmentsDetailTab,
  evaluationsDetailTab,
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

const rightSidebarPanels = [
  notesSidebarPanel,
  attachmentsSidebarPanel,
  evaluationsSidebarPanel,
];

const features = [taxonomyWeb, workflowsWeb, automationsWeb];

const columnRenderers = {
  AvatarNameCell: { component: AvatarNameCell },
  TaskAssigneeCell: { component: TaskAssigneeCell },
};

const debugProfiling = import.meta.env.DEV || import.meta.env.VITE_DEBUG_PROFILING === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {debugProfiling && (
      <DebugProfilerProvider>
        <DebugProfilerBar />
      </DebugProfilerProvider>
    )}
    <WebShell
      domains={[complianceWeb]}
      apiFn={api}
      brandLabel="Compliance"
      features={features}
      extraMenuItems={addonMenuItems}
      extraRoutes={addonRoutes}
      extraEntityUIConfigs={[TASKS_UI_CONFIG, USERS_UI_CONFIG]}
      extraDetailTabs={detailTabs}
      extraRightSidebarPanels={rightSidebarPanels}
      extraColumnRenderers={columnRenderers}
    />
  </StrictMode>,
);
