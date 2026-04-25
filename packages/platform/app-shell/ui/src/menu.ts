import {
  Blocks,
  ListTodo,
  Shield,
  SlidersHorizontal,
  Users,
  Wrench,
} from 'lucide-react';
import type { MenuItem } from '@packages/domains';

/**
 * Menu items contributed by the platform shell itself. Domain manifests +
 * frontend feature manifests (taxonomy, automations, ...) extend this with
 * their own entries. Addon-packaged entries should ride on a
 * WebFeatureManifest's `menuItems` rather than be hardcoded here.
 *
 * Items contributed by features that target an existing parent path (e.g.
 * `parent: '/management'`) are nested into that parent's children by
 * WebShell before this list reaches the layout.
 */
export const platformMenuItems: MenuItem[] = [
  { path: '/users', label: 'Users', icon: Users, permission: 'users.read', position: 'after' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'rbac.roles-read', position: 'after' },
  {
    path: '/management',
    label: 'Management',
    icon: Wrench,
    position: 'after',
    children: [
      { path: '/settings', label: 'Entity Config', icon: Blocks },
      { path: '/app-settings', label: 'App Settings', icon: SlidersHorizontal, permission: 'settings.read' },
      { path: '/queued-tasks', label: 'Queued Tasks', icon: ListTodo, permission: 'queues.read' },
    ],
  },
];
