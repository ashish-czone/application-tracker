import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { PageHeader, type PageHeaderProps, type PageHeaderTitleSize } from './PageHeader';
import { MetricKPI, type MetricKPIProps } from '../data-display/MetricKPI';

export type ScreenLayoutKpiColumns = 2 | 3 | 4;

export interface ScreenLayoutProps {
  /** Rendered outside `main` — app shell top bar / nav. */
  topBar?: ReactNode;
  /** Passed through to the built-in PageHeader. */
  breadcrumb?: PageHeaderProps['breadcrumb'];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleSize?: PageHeaderTitleSize;
  /** Banner rendered below the header — spacing (mb-6) is managed here. */
  alert?: ReactNode;
  /** KPI row rendered in a hairline grid. Order = render order. */
  kpis?: MetricKPIProps[];
  /** Responsive column count for the KPI grid. Default: 4. */
  kpiColumns?: ScreenLayoutKpiColumns;
  /** Main content — tabs, toolbar, data grid, etc. */
  children?: ReactNode;
  className?: string;
  /** Override the default `max-w-[1480px] mx-auto px-10 py-8`. */
  mainClassName?: string;
}

const KPI_GRID_COLS: Record<ScreenLayoutKpiColumns, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
};

export function ScreenLayout({
  topBar,
  breadcrumb,
  title,
  subtitle,
  actions,
  titleSize,
  alert,
  kpis,
  kpiColumns = 4,
  children,
  className,
  mainClassName,
}: ScreenLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-paper paper-grain', className)}>
      {topBar}
      <main className={cn('max-w-[1480px] mx-auto px-10 py-8', mainClassName)}>
        <PageHeader
          breadcrumb={breadcrumb}
          title={title}
          subtitle={subtitle}
          actions={actions}
          titleSize={titleSize}
        />
        {alert && <div className="mb-6">{alert}</div>}
        {kpis && kpis.length > 0 && (
          <section
            className={cn(
              'grid grid-cols-1 gap-px bg-rule border border-rule',
              KPI_GRID_COLS[kpiColumns],
            )}
          >
            {kpis.map((kpi, i) => (
              <MetricKPI key={i} index={kpi.index ?? i} {...kpi} />
            ))}
          </section>
        )}
        {children}
      </main>
    </div>
  );
}
