import { Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../Button';
import type { DataGridEmptyState } from './types';

interface DataGridEmptyProps {
  emptyState?: DataGridEmptyState;
  isError?: boolean;
  onRetry?: () => void;
}

export function DataGridEmpty({ emptyState, isError, onRetry }: DataGridEmptyProps) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">Something went wrong</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Failed to load data. Please try again.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  const Icon = emptyState?.icon ?? Inbox;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium text-foreground mb-1">
        {emptyState?.title ?? 'No results found'}
      </h3>
      {emptyState?.description && (
        <p className="text-sm text-muted-foreground mb-4">{emptyState.description}</p>
      )}
      {emptyState?.action && (
        <Button size="sm" onClick={emptyState.action.onClick}>
          {emptyState.action.label}
        </Button>
      )}
    </div>
  );
}
