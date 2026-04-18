import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type DrawerHeaderTitleSize = 'sm' | 'md' | 'lg';

export interface DrawerHeaderProps {
  /** Row rendered above the title — eyebrow + optional adjacent chips/badges. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Paragraph shown below the title — italic serif by default. */
  subtitle?: ReactNode;
  /** Close handler — when provided, a close button is rendered top-right. */
  onClose?: () => void;
  closeLabel?: string;
  /** Title size. `sm` = text-2xl, `md` = text-3xl (default), `lg` = text-4xl. */
  titleSize?: DrawerHeaderTitleSize;
  /** Optional content rendered after the subtitle — e.g. workflow bar. */
  children?: ReactNode;
  className?: string;
}

const TITLE_SIZE: Record<DrawerHeaderTitleSize, string> = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

export function DrawerHeader({
  eyebrow,
  title,
  subtitle,
  onClose,
  closeLabel = 'Close drawer',
  titleSize = 'md',
  children,
  className,
}: DrawerHeaderProps) {
  return (
    <header
      className={cn(
        'px-6 pt-6 pb-4 border-b border-rule flex-none',
        className,
      )}
    >
      {(eyebrow || onClose) && (
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">{eyebrow}</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink transition-colors -mt-1 -mr-1"
              aria-label={closeLabel}
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
      <h2
        className={cn('font-serif text-ink leading-tight', TITLE_SIZE[titleSize])}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="font-serif italic text-ink-soft text-sm mt-2">{subtitle}</p>
      )}
      {children}
    </header>
  );
}
