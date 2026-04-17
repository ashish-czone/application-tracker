import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useSlidingHighlight } from '../hooks/useSlidingHighlight';

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
  /** Enable sliding highlight animation (underline variant only). */
  animated?: boolean;
  className?: string;
}

/**
 * Editorial tab strip for coarse cuts — e.g. All / Active / Draft / Deprecated.
 *
 * **underline** (default) — hairline rule spans the full width; the active tab
 * draws a solid ink underline.
 *
 * **segmented** — bordered slab of cells; the active cell gets a solid ink
 * background. Reads like a filing-toggle.
 */
export function CoarseTabs<T extends string = string>({
  tabs,
  value,
  onChange,
  variant = 'underline',
  animated = false,
  className,
}: CoarseTabsProps<T>) {
  const highlight = useSlidingHighlight<T>(value);
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
      ref={highlight.containerRef}
      role="tablist"
      className={cn('relative flex items-center gap-6 border-b border-rule', className)}
    >
      {highlight.rect && (
        <motion.span
          aria-hidden
          className="absolute bottom-0 h-[2px] bg-ink"
          initial={false}
          animate={{ left: highlight.rect.left, width: highlight.rect.width }}
          transition={animated ? highlight.transition : { duration: 0 }}
        />
      )}
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => highlight.setItemRef(tab.value, el)}
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
          </button>
        );
      })}
    </div>
  );
}
