import { useMemo } from 'react';
import { useAuth } from '@packages/auth-ui';
import { getRegisteredWidget } from './registry';
import type { DashboardWidget } from './types';

export function useDashboardLayout(widgetIds: readonly string[]): {
  widgets: DashboardWidget[];
  missing: string[];
} {
  const { can } = useAuth();
  return useMemo(() => {
    const widgets: DashboardWidget[] = [];
    const missing: string[] = [];
    for (const id of widgetIds) {
      const widget = getRegisteredWidget(id);
      if (!widget) {
        missing.push(id);
        continue;
      }
      if (widget.requiredPermission && !can(widget.requiredPermission)) continue;
      widgets.push(widget);
    }
    return { widgets, missing };
  }, [widgetIds, can]);
}
