import { LayoutDashboard } from 'lucide-react';
import { useDashboardLayout } from '../hooks';
import { WidgetCard } from './WidgetCard';

interface DashboardGridProps {
  widgetIds: readonly string[];
}

export function DashboardGrid({ widgetIds }: DashboardGridProps) {
  const { widgets, missing } = useDashboardLayout(widgetIds);

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <LayoutDashboard className="w-10 h-10 text-ink-muted mb-4" strokeWidth={1.5} />
        <p className="font-serif text-xl text-ink">Your dashboard is empty</p>
        <p className="mt-2 text-sm text-ink-soft max-w-sm">
          {missing.length > 0
            ? 'No widgets are registered yet. Contributing packages need to call registerDashboardWidget() at app bootstrap.'
            : 'You do not have permission to see the widgets configured on this dashboard.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {widgets.map((widget) => {
        const Widget = widget.component;
        return (
          <WidgetCard key={widget.id} title={widget.title} size={widget.defaultSize}>
            <Widget />
          </WidgetCard>
        );
      })}
    </div>
  );
}
