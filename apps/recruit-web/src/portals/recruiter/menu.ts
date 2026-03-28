import { LayoutDashboard, Settings, Bell, Shield, Users, CheckSquare, SlidersHorizontal, Tags, FolderTree, Layers, GitBranch } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  /** Position: 'before' renders before entity nav items, 'after' renders after */
  position?: 'before' | 'after';
  /** Nested sub-items — renders as collapsible group */
  children?: MenuItem[];
}

export const recruiterMenu: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, position: 'before' },
  // Entity nav items (Candidates, Job Openings, etc.) are auto-generated here
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, permission: 'tasks.read', position: 'after' },
  { path: '/users', label: 'Users', icon: Users, permission: 'users.read', position: 'after' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'rbac.roles-read', position: 'after' },
  { path: '/automations', label: 'Automations', icon: Bell, permission: 'notifications.rules.read', position: 'after' },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    position: 'after',
    children: [
      { path: '/settings', label: 'Fields & Layouts', icon: Layers },
      { path: '/settings?tab=pipeline', label: 'Pipelines', icon: GitBranch, permission: 'workflows.manage' },
      { path: '/app-settings', label: 'App Settings', icon: SlidersHorizontal, permission: 'settings.read' },
      { path: '/tag-groups', label: 'Tag Groups', icon: Tags, permission: 'taxonomy.tag-groups.read' },
      { path: '/categories', label: 'Categories', icon: FolderTree, permission: 'taxonomy.categories.read' },
    ],
  },
];
