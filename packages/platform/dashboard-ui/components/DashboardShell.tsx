import type { ReactNode } from 'react';
import { DashboardGrid } from './DashboardGrid';

interface DashboardShellProps {
  widgetIds: readonly string[];
  header?: ReactNode;
}

export function DashboardShell({ widgetIds, header }: DashboardShellProps) {
  return (
    <div className="w-full">
      {header}
      <DashboardGrid widgetIds={widgetIds} />
    </div>
  );
}
