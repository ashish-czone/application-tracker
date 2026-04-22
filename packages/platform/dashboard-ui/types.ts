import type { ComponentType } from 'react';

export type DashboardWidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface DashboardWidget {
  id: string;
  title: string;
  component: ComponentType;
  defaultSize: DashboardWidgetSize;
  requiredPermission?: string;
  category?: string;
}
