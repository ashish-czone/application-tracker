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

const ConsolePreviewPage = lazy(() =>
  import('./portals/customer/features/console-preview').then((m) => ({
    default: m.ConsolePreviewPage,
  })),
);

const DashboardScreenPage = lazy(() =>
  import('./portals/customer/features/screens/dashboard').then((m) => ({
    default: m.DashboardScreenPage,
  })),
);

const ClientsPage = lazy(() =>
  import('./portals/customer/features/screens/clients').then((m) => ({
    default: m.ClientsPage,
  })),
);

const ClientDetailPage = lazy(() =>
  import('./portals/customer/features/screens/clients').then((m) => ({
    default: m.ClientDetailPage,
  })),
);

const FilingsPage = lazy(() =>
  import('./portals/customer/features/screens/filings').then((m) => ({
    default: m.FilingsPage,
  })),
);

const ObligationsLibraryPage = lazy(() =>
  import('./portals/customer/features/screens/obligations').then((m) => ({
    default: m.ObligationsLibraryPage,
  })),
);

const LawsLibraryPage = lazy(() =>
  import('./portals/customer/features/screens/laws').then((m) => ({
    default: m.LawsLibraryPage,
  })),
);

const ReportsPage = lazy(() =>
  import('./portals/customer/features/screens/reports').then((m) => ({
    default: m.ReportsPage,
  })),
);

const UsersPage = lazy(() =>
  import('./portals/customer/features/screens/users').then((m) => ({
    default: m.UsersPage,
  })),
);

const RolesEditorPage = lazy(() =>
  import('./portals/customer/features/screens/roles').then((m) => ({
    default: m.RolesEditorPage,
  })),
);

const SettingsPage = lazy(() =>
  import('./portals/customer/features/screens/settings').then((m) => ({
    default: m.SettingsPage,
  })),
);

const AdminSettingsPage = lazy(() =>
  import('./portals/customer/features/screens/admin-settings').then((m) => ({
    default: m.AdminSettingsPage,
  })),
);

const GlobalSetsPage = lazy(() =>
  import('./portals/customer/features/screens/global-sets').then((m) => ({
    default: m.GlobalSetsPage,
  })),
);

const OrgHierarchyPage = lazy(() =>
  import('./portals/customer/features/screens/org-hierarchy').then((m) => ({
    default: m.OrgHierarchyPage,
  })),
);

/**
 * Compliance domain UI manifest. The `console-preview` route is a static
 * design-review surface showing the Instrument kit in context — not wired
 * to live data. See `design-directions.md` for the aesthetic rationale.
 *
 * Permission strings on each route are interpreted by AppRouter, which
 * wraps the element in `<PermissionGuard>` when present. Permission keys
 * for entities (clients, laws, etc.) are auto-registered by EntityEngine;
 * UI-only screens (filings, obligations, reports) come from
 * `domains/compliance/api/permissions.ts`. Dashboard is auth-only — its
 * blocks are gated component-level via `<Can>`.
 */
const routes: DomainRouteObject[] = [
  { path: '/console-preview', element: <ConsolePreviewPage /> },
  { path: '/dashboard', element: <DashboardScreenPage /> },
  { path: '/clients', element: <ClientsPage />, permission: 'clients.read' },
  { path: '/clients/:clientId', element: <ClientDetailPage />, permission: 'clients.read' },
  { path: '/filings', element: <FilingsPage />, permission: 'filings.read' },
  { path: '/obligations', element: <ObligationsLibraryPage />, permission: 'obligations.read' },
  { path: '/laws', element: <LawsLibraryPage />, permission: 'laws.read' },
  { path: '/reports', element: <ReportsPage />, permission: 'reports.read' },
  { path: '/compliance-users', element: <UsersPage />, permission: 'users.read' },
  { path: '/compliance-roles', element: <RolesEditorPage />, permission: 'rbac.roles-read' },
  { path: '/compliance-settings', element: <SettingsPage />, permission: 'settings.read' },
  { path: '/admin-settings', element: <AdminSettingsPage />, permission: 'settings.manage' },
  { path: '/global-sets', element: <GlobalSetsPage />, permission: 'taxonomy.categories.read' },
  { path: '/org-hierarchy', element: <OrgHierarchyPage />, permission: 'org-units.read' },
];

const menuItems: MenuItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Gauge, position: 'before' },
  { path: '/clients', label: 'Clients', icon: Building2, permission: 'clients.read', position: 'before' },
  { path: '/filings', label: 'Filings', icon: CalendarClock, permission: 'filings.read', position: 'before' },
  { path: '/obligations', label: 'Obligations', icon: ListChecks, permission: 'obligations.read', position: 'before' },
  { path: '/laws', label: 'Laws', icon: Scale, permission: 'laws.read', position: 'before' },
  { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.read', position: 'before' },
  {
    path: '/compliance-admin',
    label: 'Admin',
    icon: ShieldCheck,
    position: 'after',
    children: [
      { path: '/compliance-users', label: 'Users', icon: Users, permission: 'users.read' },
      { path: '/compliance-roles', label: 'Roles', icon: Shield, permission: 'rbac.roles-read' },
      { path: '/global-sets', label: 'Global Sets', icon: Layers, permission: 'taxonomy.categories.read' },
      { path: '/compliance-settings', label: 'Settings', icon: Settings, permission: 'settings.read' },
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
  entityUIConfigs: [],
};
