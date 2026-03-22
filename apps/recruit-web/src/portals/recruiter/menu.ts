import { LayoutDashboard, Users, Settings, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

export const recruiterMenu: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/candidates', label: 'Candidates', icon: Users, permission: 'candidates.read' },
  { path: '/automations', label: 'Automations', icon: Bell, permission: 'notifications.rules.read' },
  { path: '/settings', label: 'Settings', icon: Settings },
];
