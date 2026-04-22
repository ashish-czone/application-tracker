import type { ReactNode } from 'react';
import type { DashboardWidgetSize } from '../types';

const SIZE_TO_COL_SPAN: Record<DashboardWidgetSize, string> = {
  sm: 'col-span-12 md:col-span-6 xl:col-span-3',
  md: 'col-span-12 md:col-span-6',
  lg: 'col-span-12 xl:col-span-8',
  full: 'col-span-12',
};

interface WidgetCardProps {
  title: string;
  size: DashboardWidgetSize;
  action?: ReactNode;
  children: ReactNode;
}

export function WidgetCard({ title, size, action, children }: WidgetCardProps) {
  return (
    <section className={`${SIZE_TO_COL_SPAN[size]} flex flex-col bg-paper-raised border border-rule`}>
      <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule">
        <h2 className="font-serif text-lg text-ink leading-none">{title}</h2>
        {action ? <div className="flex items-center gap-1">{action}</div> : null}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}
