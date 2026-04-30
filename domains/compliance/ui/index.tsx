import { lazy } from 'react';
import {
  BarChart3,
  Building2,
  CalendarClock,
  FileText,
  Gauge,
  Layers,
  ListChecks,
  Network,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { DomainRouteObject, DomainWebManifest, MenuItem } from '@packages/domains';
import { CLIENT_CONTACTS_UI_CONFIG } from './entity-configs/client-contacts.ui';
import { CLIENT_REGISTRATIONS_UI_CONFIG } from './entity-configs/client-registrations.ui';
import { CLIENTS_UI_CONFIG } from './entity-configs/clients.ui';
import { COMPLIANCE_FILINGS_UI_CONFIG } from './entity-configs/compliance-filings.ui';
import { COMPLIANCE_RULES_UI_CONFIG } from './entity-configs/rules.ui';
import { LAW_HANDLERS_UI_CONFIG } from './entity-configs/law-handlers.ui';
import { LAWS_UI_CONFIG } from './entity-configs/laws.ui';
import { ORGANIZATIONS_UI_CONFIG } from './entity-configs/organizations.ui';

const DashboardPage = lazy(() =>
  import('./portals/customer/features/dashboard').then((m) => ({
    default: m.DashboardPage,
  })),
);

const ClientsPage = lazy(() =>
  import('./portals/customer/features/clients').then((m) => ({
    default: m.ClientsPage,
  })),
);

const ClientDetailPage = lazy(() =>
  import('./portals/customer/features/clients').then((m) => ({
    default: m.ClientDetailPage,
  })),
);

const FilingsPage = lazy(() =>
  import('./portals/customer/features/filings').then((m) => ({
    default: m.FilingsPage,
  })),
);

const ComplianceRulesPage = lazy(() =>
  import('./portals/customer/features/compliance-rules').then((m) => ({
    default: m.ComplianceRulesPage,
  })),
);

const RuleEditPage = lazy(() =>
  import('./portals/customer/features/compliance-rules/RuleEditPage').then((m) => ({
    default: m.RuleEditPage,
  })),
);

const LawsLibraryPage = lazy(() =>
  import('./portals/customer/features/laws').then((m) => ({
    default: m.LawsLibraryPage,
  })),
);

const ReportsPage = lazy(() =>
  import('./portals/customer/features/reports').then((m) => ({
    default: m.ReportsPage,
  })),
);

const UsersPage = lazy(() =>
  import('./portals/customer/features/users').then((m) => ({
    default: m.UsersPage,
  })),
);

const RolesEditorPage = lazy(() =>
  import('./portals/customer/features/roles').then((m) => ({
    default: m.RolesEditorPage,
  })),
);

const SettingsPage = lazy(() =>
  import('./portals/customer/features/settings').then((m) => ({
    default: m.SettingsPage,
  })),
);

const AdminSettingsPage = lazy(() =>
  import('./portals/customer/features/admin-settings').then((m) => ({
    default: m.AdminSettingsPage,
  })),
);

const GlobalSetsPage = lazy(() =>
  import('./portals/customer/features/global-sets').then((m) => ({
    default: m.GlobalSetsPage,
  })),
);

const OrgHierarchyPage = lazy(() =>
  import('./portals/customer/features/org-hierarchy').then((m) => ({
    default: m.OrgHierarchyPage,
  })),
);

const OrganizationPage = lazy(() =>
  import('./portals/customer/features/organization').then((m) => ({
    default: m.OrganizationPage,
  })),
);

/**
 * Compliance domain UI manifest.
 *
 * Permission strings on each route are interpreted by AppRouter, which
 * wraps the element in `<PermissionGuard>` when present. Permission keys
 * for entities (clients, laws, compliance-rules, compliance-filings, etc.)
 * are auto-registered by EntityEngine; UI-only screens (reports) come from
 * `domains/compliance/api/permissions.ts`. Dashboard is auth-only — its
 * blocks are gated component-level via `<Can>`.
 */
// All compliance screens ship their own `ScreenPreviewTopBar` + page chrome,
// so they opt out of the platform `AppLayout` via `bareLayout: true`. Auth +
// permission gating still apply.
const routes: DomainRouteObject[] = [
  { path: '/dashboard', element: <DashboardPage />, bareLayout: true },
  { path: '/clients', element: <ClientsPage />, permission: 'clients.read', bareLayout: true },
  { path: '/clients/:clientId', element: <ClientDetailPage />, permission: 'clients.read', bareLayout: true },
  { path: '/filings', element: <FilingsPage />, permission: 'compliance-filings.read', bareLayout: true },
  { path: '/compliance-rules', element: <ComplianceRulesPage />, permission: 'compliance-rules.read', bareLayout: true },
  { path: '/compliance-rules/:id/edit', element: <RuleEditPage />, permission: 'compliance-rules.update' },
  { path: '/laws', element: <LawsLibraryPage />, permission: 'laws.read', bareLayout: true },
  { path: '/reports', element: <ReportsPage />, permission: 'reports.read', bareLayout: true },
  { path: '/compliance-users', element: <UsersPage />, permission: 'users.read', bareLayout: true },
  { path: '/compliance-roles', element: <RolesEditorPage />, permission: 'rbac.roles.read', bareLayout: true },
  { path: '/compliance-settings', element: <SettingsPage />, permission: 'settings.read', bareLayout: true },
  { path: '/admin-settings', element: <AdminSettingsPage />, permission: 'settings.manage', bareLayout: true },
  { path: '/organization', element: <OrganizationPage />, permission: 'organizations.update', bareLayout: true },
  { path: '/global-sets', element: <GlobalSetsPage />, permission: 'taxonomy.categories.read', bareLayout: true },
  { path: '/org-hierarchy', element: <OrgHierarchyPage />, permission: 'org-units.read', bareLayout: true },
];

const menuItems: MenuItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Gauge, position: 'before' },
  { path: '/clients', label: 'Clients', icon: Building2, permission: 'clients.read', position: 'before' },
  { path: '/filings', label: 'Filings', icon: CalendarClock, permission: 'compliance-filings.read', position: 'before' },
  { path: '/compliance-rules', label: 'Compliance Rules', icon: ListChecks, permission: 'compliance-rules.read', position: 'before' },
  { path: '/laws', label: 'Laws', icon: Scale, permission: 'laws.read', position: 'before' },
  { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.read', position: 'before' },
  {
    path: '/compliance-admin',
    label: 'Admin',
    icon: ShieldCheck,
    position: 'after',
    children: [
      { path: '/compliance-users', label: 'Users', icon: Users, permission: 'users.read' },
      { path: '/compliance-roles', label: 'Roles', icon: Shield, permission: 'rbac.roles.read' },
      { path: '/global-sets', label: 'Global Sets', icon: Layers, permission: 'taxonomy.categories.read' },
      { path: '/compliance-settings', label: 'Settings', icon: Settings, permission: 'settings.read' },
      { path: '/organization', label: 'Organization', icon: Building2, permission: 'organizations.update' },
      { path: '/admin-settings', label: 'Admin Settings', icon: FileText, permission: 'settings.manage' },
      { path: '/org-hierarchy', label: 'Org Hierarchy', icon: Network, permission: 'org-units.read' },
    ],
  },
];

export const complianceWeb: DomainWebManifest = {
  name: 'compliance',
  displayName: 'Compliance',
  routes,
  detailPageOverrides: {},
  menuItems,
  entityUIConfigs: [
    CLIENT_CONTACTS_UI_CONFIG,
    CLIENT_REGISTRATIONS_UI_CONFIG,
    CLIENTS_UI_CONFIG,
    COMPLIANCE_FILINGS_UI_CONFIG,
    COMPLIANCE_RULES_UI_CONFIG,
    LAW_HANDLERS_UI_CONFIG,
    LAWS_UI_CONFIG,
    ORGANIZATIONS_UI_CONFIG,
  ],
};
