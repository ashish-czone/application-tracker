import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export type PageHeaderTitleSize = 'md' | 'lg' | 'xl';

export interface PageHeaderProps {
  /**
   * Breadcrumb trail. Strings are rendered with small-caps eyebrow styling —
   * the last item is emphasised. Pass a `ReactNode` for fully custom markup.
   */
  breadcrumb?: string[] | ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned action row (buttons, toggles). */
  actions?: ReactNode;
  /** Title size. `md` = text-2xl, `lg` = text-3xl, `xl` = text-4xl (default). */
  titleSize?: PageHeaderTitleSize;
  className?: string;
}

const TITLE_SIZE: Record<PageHeaderTitleSize, string> = {
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

function BreadcrumbTrail({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={`${idx}-${item}`}>
            <span className={isLast ? 'text-ink' : undefined}>{item}</span>
            {!isLast && <ChevronRight className="w-3 h-3" strokeWidth={1.5} />}
          </Fragment>
        );
      })}
    </div>
  );
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  titleSize = 'xl',
  className,
}: PageHeaderProps) {
  const breadcrumbNode = Array.isArray(breadcrumb) ? (
    <BreadcrumbTrail items={breadcrumb} />
  ) : (
    breadcrumb
  );

  return (
    <header className={cn('flex items-end justify-between mb-8', className)}>
      <div className="min-w-0">
        {breadcrumbNode}
        <h1
          className={cn(
            'font-serif text-ink leading-none mt-1',
            TITLE_SIZE[titleSize],
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
