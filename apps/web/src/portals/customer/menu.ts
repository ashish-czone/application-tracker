import { LayoutDashboard, Users, Shield, CheckSquare, Workflow, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const customerMenu: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/roles', label: 'Roles', icon: Shield },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/workflows', label: 'Workflows', icon: Workflow },
  { path: '/automations', label: 'Automations', icon: Zap },
];
