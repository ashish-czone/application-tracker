import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
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

import { WebShell } from '@packages/app-shell-ui';
import { TASKS_UI_CONFIG, TaskAssigneeCell } from '@packages/tasks-ui';
import { OrgUnitsPage, OrgPositionsPage } from '@packages/org-units-ui';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import { EvaluationsSection } from '@packages/evaluations-ui';
import { AuditTimeline } from '@packages/audit-ui';
import { AvatarNameCell } from '@packages/ui';
import { CheckSquare, Building2, UserCog, Network } from 'lucide-react';
import type { MenuItem } from '@packages/domains';
import { complianceWeb } from '@domains/compliance-ui';
import { ConsolePreviewPage } from '@domains/compliance-ui/portals/customer/features/console-preview';
import { DashboardScreenPage } from '@domains/compliance-ui/portals/customer/features/screens/dashboard';
import { ObligationsLibraryPage } from '@domains/compliance-ui/portals/customer/features/screens/obligations';
import { ClientsPage, ClientDetailPage } from '@domains/compliance-ui/portals/customer/features/screens/clients';
import { FilingsPage } from '@domains/compliance-ui/portals/customer/features/screens/filings';
import { OrgHierarchyPage } from '@domains/compliance-ui/portals/customer/features/screens/org-hierarchy';
import { RolesEditorPage } from '@domains/compliance-ui/portals/customer/features/screens/roles';
import { UsersPage } from '@domains/compliance-ui/portals/customer/features/screens/users';
import { ReportsPage } from '@domains/compliance-ui/portals/customer/features/screens/reports';
import { SettingsPage } from '@domains/compliance-ui/portals/customer/features/screens/settings';
import { api } from './lib/api';
import './globals.css';

const addonMenuItems: MenuItem[] = [
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, position: 'after' },
  { path: '/org-units', label: 'Org Structure', icon: Building2, permission: 'org-units.read', position: 'after' },
  { path: '/org-positions', label: 'Org Positions', icon: UserCog, permission: 'org-units.read', position: 'after' },
  { path: '/screens/org-hierarchy', label: 'Org Hierarchy', icon: Network, position: 'after' },
];

const addonRoutes = [
  { path: '/org-units', element: <OrgUnitsPage /> },
  { path: '/org-positions', element: <OrgPositionsPage /> },
  { path: '/screens/org-hierarchy', element: <OrgHierarchyPage /> },
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

// Design-preview fork: `/console-preview` and `/screens/*` render outside the
// WebShell for unauthenticated design review, inside their own BrowserRouter
// so the preview nav can use client-side navigation. Every other path goes
// through the normal authenticated WebShell (which provides its own router).
// Remove once the Instrument design ships.
const pathname = window.location.pathname;
const isPreview =
  pathname.startsWith('/console-preview') || pathname.startsWith('/screens/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPreview ? (
      <BrowserRouter>
        <Routes>
          <Route path="/console-preview" element={<ConsolePreviewPage />} />
          <Route path="/screens/dashboard" element={<DashboardScreenPage />} />
          <Route path="/screens/obligations" element={<ObligationsLibraryPage />} />
          <Route path="/screens/clients" element={<ClientsPage />} />
          <Route path="/screens/clients/:clientId" element={<ClientDetailPage />} />
          <Route path="/screens/filings" element={<FilingsPage />} />
          <Route path="/screens/org-hierarchy" element={<OrgHierarchyPage />} />
          <Route path="/screens/roles" element={<RolesEditorPage />} />
          <Route path="/screens/users" element={<UsersPage />} />
          <Route path="/screens/reports" element={<ReportsPage />} />
          <Route path="/screens/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
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
