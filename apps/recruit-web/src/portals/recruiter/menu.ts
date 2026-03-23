import { LayoutDashboard, Settings, Bell } from 'lucide-react';
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
  { path: '/automations', label: 'Automations', icon: Bell, permission: 'notifications.rules.read', position: 'after' },
  { path: '/settings', label: 'Settings', icon: Settings, position: 'after' },
];
