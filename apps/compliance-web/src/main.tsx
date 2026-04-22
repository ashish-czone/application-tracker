import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntityEngineProvider } from '@packages/entity-engine-ui';
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

import { WebShell } from '@packages/app-shell-ui';
import { DebugProfilerBar, DebugProfilerProvider } from '@packages/debug-profiler-ui';
import { TASKS_UI_CONFIG, TaskAssigneeCell } from '@packages/tasks-ui';
import { OrgUnitsPage, OrgPositionsPage } from '@packages/org-units-ui';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import { EvaluationsSection } from '@packages/evaluations-ui';
import { AuditTimeline } from '@packages/audit-ui';
import { AvatarNameCell, Toaster } from '@packages/ui';
import { CheckSquare, Building2, UserCog } from 'lucide-react';
import type { MenuItem } from '@packages/domains';
import { complianceWeb } from '@domains/compliance-ui';
import {
  ConsolePreviewPage,
  ConsolePreviewPageV2,
} from '@domains/compliance-ui/portals/customer/features/console-preview';
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
  { key: 'notes', label: 'Notes', order: 100, component: NotesSection, featureFlag: 'hasNotes' },
  { key: 'attachments', label: 'Attachments', order: 200, component: AttachmentsSection, featureFlag: 'hasAttachments' },
  { key: 'evaluations', label: 'Evaluations', order: 300, component: EvaluationsSection, featureFlag: 'hasEvaluations' },
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

const rightSidebarPanels = [
  { key: 'notes', label: 'Notes', order: 100, component: NotesSection, featureFlag: 'hasNotes' },
  { key: 'files', label: 'Files', order: 200, component: AttachmentsSection, featureFlag: 'hasAttachments' },
  { key: 'evaluations', label: 'Evaluations', order: 300, component: EvaluationsSection, featureFlag: 'hasEvaluations' },
];

const columnRenderers = {
  AvatarNameCell: { component: AvatarNameCell },
  TaskAssigneeCell: { component: TaskAssigneeCell },
};

// Design-preview fork: `/console-preview*` renders outside the WebShell for
// unauthenticated design review, inside its own BrowserRouter so the preview
// nav can use client-side navigation. Every other path goes through the
// normal authenticated WebShell — including the formerly-unauthenticated
// `/screens/*` design surfaces, which now live under the compliance domain
// manifest at clean paths (`/dashboard`, `/clients`, ...) and are protected
// by AuthGuard + per-route PermissionGuard.
// Remove this fork once the Instrument design ships.
const pathname = window.location.pathname;
const isPreview = pathname.startsWith('/console-preview');

const previewQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const debugProfiling = import.meta.env.DEV || import.meta.env.VITE_DEBUG_PROFILING === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {debugProfiling && (
      <DebugProfilerProvider>
        <DebugProfilerBar />
      </DebugProfilerProvider>
    )}
    {isPreview ? (
      <QueryClientProvider client={previewQueryClient}>
        <EntityEngineProvider apiFn={api as never}>
          <BrowserRouter>
            <Routes>
              <Route path="/console-preview" element={<ConsolePreviewPage />} />
              <Route path="/console-preview-v2" element={<ConsolePreviewPageV2 />} />
            </Routes>
            <Toaster />
          </BrowserRouter>
        </EntityEngineProvider>
      </QueryClientProvider>
    ) : (
      <WebShell
        domains={[complianceWeb]}
        apiFn={api}
        brandLabel="Compliance"
        extraMenuItems={addonMenuItems}
        extraRoutes={addonRoutes}
        extraEntityUIConfigs={[TASKS_UI_CONFIG]}
        extraDetailTabs={detailTabs}
        extraRightSidebarPanels={rightSidebarPanels}
        extraColumnRenderers={columnRenderers}
      />
    )}
  </StrictMode>,
);
