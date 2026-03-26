import { LayoutDashboard, Settings, Bell, Shield, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  /** Position: 'before' renders before entity nav items, 'after' renders after */
  position?: 'before' | 'after';
}

export const recruiterMenu: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, position: 'before' },
  // Entity nav items (Candidates, Job Openings, etc.) are auto-generated here
  { path: '/users', label: 'Users', icon: Users, permission: 'users.read', position: 'after' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'rbac.roles-read', position: 'after' },
  { path: '/automations', label: 'Automations', icon: Bell, permission: 'notifications.rules.read', position: 'after' },
  { path: '/settings', label: 'Settings', icon: Settings, position: 'after' },
];
