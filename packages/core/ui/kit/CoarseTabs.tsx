import { type ReactNode } from 'react';
import { cn } from '../lib/utils';

export type CoarseTabVariant = 'underline' | 'segmented';

export interface CoarseTabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Optional count shown as a mono pip next to the label. */
  count?: number;
}

export interface CoarseTabsProps<T extends string = string> {
  tabs: CoarseTabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  /** @default "underline" */
  variant?: CoarseTabVariant;
  className?: string;
}

/**
 * Editorial tab strip for coarse cuts — e.g. All / Active / Draft / Deprecated.
 *
 * **underline** (default) — hairline rule spans the full width; the active tab
 * draws a solid ink underline.
 *
 * **segmented** — bordered slab of cells; the active cell inverts to ink
 * background. Reads like a filing-toggle.
 */
export function CoarseTabs<T extends string = string>({
  tabs,
  value,
  onChange,
  variant = 'underline',
  className,
}: CoarseTabsProps<T>) {
  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex items-center border border-rule bg-paper-raised overflow-hidden',
          className,
        )}
      >
        {tabs.map((tab, i) => {
          const active = tab.value === value;
          const last = i === tabs.length - 1;
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                'px-4 py-2.5 text-[11px] font-sans font-semibold uppercase tracking-[0.12em] transition-colors',
                !last && 'border-r border-rule',
                active
                  ? 'bg-ink text-paper'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-sunken/60',
              )}
            >
              <span className="inline-flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'font-mono tabular-nums text-[10px]',
                      active ? 'text-paper/70' : 'text-ink-muted',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-6 border-b border-rule', className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative py-2.5 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] transition-colors',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'font-mono tabular-nums text-[10px]',
                    active ? 'text-ink-soft' : 'text-ink-muted',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
