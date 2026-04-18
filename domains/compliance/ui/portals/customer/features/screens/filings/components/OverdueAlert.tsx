import { AlertTriangle } from 'lucide-react';

export interface OverdueAlertProps {
  count: number;
  clientCount: number;
  onShowOverdue: () => void;
}

export function OverdueAlert({ count, clientCount, onShowOverdue }: OverdueAlertProps) {
  return (
    <div className="border border-signal/40 bg-signal/5 px-5 py-3 flex items-center gap-3">
      <AlertTriangle className="w-4 h-4 text-signal flex-shrink-0" strokeWidth={2} />
      <p className="flex-1 text-sm text-ink">
        <span className="font-sans font-medium">
          {count} filing{count !== 1 ? 's' : ''} overdue
        </span>{' '}
        <span className="text-ink-soft">
          across {clientCount} clients. Immediate action required.
        </span>
      </p>
      <button
        type="button"
        onClick={onShowOverdue}
        className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-signal hover:underline"
      >
        Show overdue →
      </button>
    </div>
  );
}
