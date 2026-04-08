import { FileText, X } from 'lucide-react';
import { Button } from '@packages/ui';
import { formatDistanceToNow } from 'date-fns';
import type { Draft } from '../types';

interface DraftRecoveryBannerProps {
  draft: Draft;
  onRestore: (data: Record<string, unknown>) => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({ draft, onRestore, onDiscard }: DraftRecoveryBannerProps) {
  const timeAgo = formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-foreground">
          You have an unsaved draft from <span className="font-medium">{timeAgo}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => onRestore(draft.data)}>
          Restore draft
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard} className="text-muted-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
