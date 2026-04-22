export { DashboardShell } from './components/DashboardShell';
export { DashboardGrid } from './components/DashboardGrid';
export { WidgetCard } from './components/WidgetCard';
export { useDashboardLayout } from './hooks';
export {
  registerDashboardWidget,
  getRegisteredWidgets,
  getRegisteredWidget,
  clearRegisteredWidgets,
} from './registry';
export type { DashboardWidget, DashboardWidgetSize } from './types';
