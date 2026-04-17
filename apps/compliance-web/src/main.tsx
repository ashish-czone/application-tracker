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
import { ClientsPage } from '@domains/compliance-ui/portals/customer/features/screens/clients';
import { FilingsPage } from '@domains/compliance-ui/portals/customer/features/screens/filings';
import { OrgHierarchyPage } from '@domains/compliance-ui/portals/customer/features/screens/org-hierarchy';
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

// Design-preview fork: `/console-preview` renders outside the WebShell for
// unauthenticated design review. `/screens/*` paths render static screen
// previews in the same unauthenticated mode, one screen per path. Every
// other path goes through the normal authenticated WebShell. Remove once
// the Instrument design ships.
const pathname = window.location.pathname;
const isConsolePreview = pathname.startsWith('/console-preview');
const isDashboardScreen = pathname.startsWith('/screens/dashboard');
const isObligationsScreen = pathname.startsWith('/screens/obligations');
const isClientsScreen = pathname.startsWith('/screens/clients');
const isFilingsScreen = pathname.startsWith('/screens/filings');
const isOrgHierarchyScreen = pathname.startsWith('/screens/org-hierarchy');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConsolePreview ? (
      <ConsolePreviewPage />
    ) : isDashboardScreen ? (
      <DashboardScreenPage />
    ) : isObligationsScreen ? (
      <ObligationsLibraryPage />
    ) : isClientsScreen ? (
      <ClientsPage />
    ) : isFilingsScreen ? (
      <FilingsPage />
    ) : isOrgHierarchyScreen ? (
      <OrgHierarchyPage />
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
