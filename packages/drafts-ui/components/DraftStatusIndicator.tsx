import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DraftSaveStatus } from '../types';

interface DraftStatusIndicatorProps {
  status: DraftSaveStatus;
  lastSavedAt: Date | null;
}

const STATUS_CONFIG: Record<DraftSaveStatus, { icon: typeof Check; label: string; className: string }> = {
  idle: { icon: Cloud, label: 'Draft', className: 'text-muted-foreground' },
  saving: { icon: Loader2, label: 'Saving...', className: 'text-muted-foreground' },
  saved: { icon: Check, label: 'Draft saved', className: 'text-muted-foreground' },
  error: { icon: AlertCircle, label: 'Save failed', className: 'text-destructive' },
};

export function DraftStatusIndicator({ status, lastSavedAt }: DraftStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs ${config.className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
      <span>
        {status === 'saved' && lastSavedAt
          ? `Saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`
          : config.label}
      </span>
    </div>
  );
}
