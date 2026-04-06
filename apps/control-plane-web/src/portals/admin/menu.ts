import { LayoutDashboard, Building, Users, Shield, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  position?: 'before' | 'after';
  children?: MenuItem[];
}

export const adminMenu: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, position: 'before' },
  { path: '/tenants', label: 'Tenants', icon: Building, position: 'after' },
  { path: '/users', label: 'Users', icon: Users, permission: 'users.read', position: 'after' },
  { path: '/roles', label: 'Roles', icon: Shield, permission: 'rbac.roles.read', position: 'after' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'settings.read', position: 'after' },
];
