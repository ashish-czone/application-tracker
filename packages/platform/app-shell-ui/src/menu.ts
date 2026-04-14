import {
  Bell,
  Blocks,
  FolderTree,
  ListTodo,
  Shield,
  SlidersHorizontal,
  Tags,
  Users,
  Wrench,
} from 'lucide-react';
import type { MenuItem } from '@packages/domains';

/**
 * Menu items contributed by the platform shell itself. Apps and domains
 * extend this with their own entries. Addon entries (Tasks, Org Units, ...)
 * come from the app via WebShellOptions.extraMenuItems since this package
 * cannot import addons.
 */
export const platformMenuItems: MenuItem[] = [
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
