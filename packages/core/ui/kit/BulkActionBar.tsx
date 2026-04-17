import { type ComponentType, type SVGProps } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface BulkActionBarAction {
  /** Short action label — rendered uppercase eyebrow style. */
  label: string;
  /** Optional lucide icon. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  /** Destructive actions get a signal-toned accent. */
  tone?: 'default' | 'danger';
  /** Disable the action (e.g. when it's not available for current selection). */
  disabled?: boolean;
}

export interface BulkActionBarProps {
  /** Number of currently-selected items. Drives the count label. */
  count: number;
  /** Singular/plural noun shown in the count — e.g. "filing" → "12 filings selected". */
  itemNoun?: string;
  /** Clear the selection. */
  onClear: () => void;
  /** Action buttons rendered in order, left-to-right. */
  actions: BulkActionBarAction[];
  className?: string;
}

/**
 * Editorial-style bulk action bar — rendered above a data grid whenever
 * rows are selected. Domain-agnostic: the consumer supplies a noun and a
 * list of actions. Caller wraps in <AnimatePresence> to get exit animations
 * when selection drops to zero.
 */
export function BulkActionBar({
  count,
  itemNoun = 'item',
  onClear,
  actions,
  className,
}: BulkActionBarProps) {
  const label = `${count} ${count === 1 ? itemNoun : `${itemNoun}s`} selected`;

  return (
    <motion.div
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -8, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      role="region"
      aria-label="Bulk actions"
      className={cn(
        'flex items-center gap-4 px-4 py-2.5 bg-ink text-paper-raised border border-ink',
        'sticky top-0 z-20',
        className,
      )}
    >
      <span className="font-mono text-[11px] tabular-nums tracking-tabular uppercase">
        {label}
      </span>

      <div className="h-4 w-px bg-paper-raised/30" aria-hidden />

      <div className="flex items-center gap-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-[5px]',
                'text-[10px] font-sans font-semibold uppercase tracking-[0.14em]',
                'transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                action.tone === 'danger'
                  ? 'text-signal hover:bg-signal hover:text-paper-raised'
                  : 'text-paper-raised hover:bg-paper-raised hover:text-ink',
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className={cn(
          'ml-auto inline-flex items-center justify-center w-7 h-7',
          'text-paper-raised/70 hover:text-paper-raised transition-colors',
        )}
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </motion.div>
  );
}
