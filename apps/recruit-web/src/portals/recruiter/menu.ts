import { LayoutDashboard, Settings, Bell, Shield, Users, SlidersHorizontal, Tags, FolderTree, Blocks, ListTodo, Wrench } from 'lucide-react';
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
  // Entity nav items (Candidates, Job Openings, Tasks, etc.) are auto-generated here
  { path: '/users', label: 'Users', icon: Users, permission: 'users.read', position: 'after' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'rbac.roles-read', position: 'after' },
  { path: '/automations', label: 'Automations', icon: Bell, permission: 'automations.rules.read', position: 'after' },
  {
    path: '/management',
    label: 'Management',
    icon: Wrench,
    position: 'after',
    children: [
      { path: '/settings', label: 'Entity Config', icon: Blocks },
      { path: '/app-settings', label: 'App Settings', icon: SlidersHorizontal, permission: 'settings.read' },
      { path: '/tag-groups', label: 'Tag Groups', icon: Tags, permission: 'taxonomy.tag-groups.read' },
      { path: '/categories', label: 'Categories', icon: FolderTree, permission: 'taxonomy.categories.read' },
      { path: '/queued-tasks', label: 'Queued Tasks', icon: ListTodo, permission: 'queues.read' },
    ],
  },
];
