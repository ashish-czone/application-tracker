import { LayoutDashboard, Users, Shield, UserCog, Building2, CheckSquare, Workflow, Zap, Settings, Tags, FolderTree, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

export const customerMenu: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'Users', icon: Users, permission: 'users.read' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'rbac.roles.read' },
  { path: '/org-units', label: 'Org Structure', icon: Building2, permission: 'org-units.read' },
  { path: '/org-positions', label: 'Org Positions', icon: UserCog, permission: 'org-units.read' },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, permission: 'tasks.read' },
  { path: '/pages', label: 'Pages', icon: FileText, permission: 'pages.read' },
  { path: '/workflows', label: 'Workflows', icon: Workflow, permission: 'workflows.read' },
  { path: '/tag-groups', label: 'Tag Groups', icon: Tags, permission: 'taxonomy.tag-groups.read' },
  { path: '/categories', label: 'Categories', icon: FolderTree, permission: 'taxonomy.categories.read' },
  { path: '/automations', label: 'Automations', icon: Zap, permission: 'automations.rules.read' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings.read' },
];
