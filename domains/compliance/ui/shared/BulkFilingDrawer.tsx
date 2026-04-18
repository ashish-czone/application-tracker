import { type HTMLAttributes } from 'react';
import { DrawerShell, DrawerHeader, Eyebrow, SectionRule } from '@packages/ui';
import { OrdinalDate } from '../components';
import { FilingTaskCard } from './FilingTaskCard';
import type { Filing } from './types';

export interface BulkFilingDrawerProps extends HTMLAttributes<HTMLDivElement> {
  filings: Filing[];
  onClose?: () => void;
  onConfirm?: () => void;
  /** For design preview, render inline at its target position with no overlay. */
  inline?: boolean;
}

/**
 * Right-side drawer to mark N filings as filed in one action. Each row is
 * a brief FilingTaskCard with a per-row override slot for actual filing date
 * and acknowledgement number (not wired up in the preview). The footer has
 * a single confirm action — bulk operations should feel deliberate.
 */
export function BulkFilingDrawer({
  filings,
  onClose,
  onConfirm,
  inline = false,
  className = '',
  ...rest
}: BulkFilingDrawerProps) {
  const inner = (
    <>
      <DrawerHeader
        eyebrow={<Eyebrow tone="muted" mark="§">Bulk File</Eyebrow>}
        title={
          <>
            Mark <span className="font-mono tabular-nums not-italic">{filings.length}</span>{' '}
            <span className="font-serif italic">filings</span> filed
          </>
        }
        subtitle="Confirm the acknowledgement and we'll stamp each row."
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
        {filings.map((f) => (
          <FilingTaskCard key={f.id} filing={f} variant="brief" />
        ))}
      </div>

      <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50">
        <div className="mb-3">
          <SectionRule label="Filing metadata" align="left" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium mb-1">
              Filing date
            </label>
            <div className="border-b border-ink pb-1.5">
              <OrdinalDate date={new Date()} variant="short" className="text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium mb-1">
              Ack. number
            </label>
            <div className="border-b border-rule pb-1.5">
              <span className="font-mono tabular-nums text-sm text-ink-muted">
                ACK-2026-0412-····
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="ml-auto px-5 py-2.5 bg-filed text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:brightness-110 transition-[filter]"
          >
            Stamp {filings.length} as filed
          </button>
        </div>
      </footer>
    </>
  );

  if (inline) {
    return (
      <div
        className={`w-full max-w-md h-full bg-paper-raised border-l border-rule flex flex-col ${className}`}
        {...rest}
      >
        {inner}
      </div>
    );
  }

  return (
    <DrawerShell onClose={onClose} width="md">
      {inner}
    </DrawerShell>
  );
}
