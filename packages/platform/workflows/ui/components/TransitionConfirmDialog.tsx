import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';

interface TransitionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the transition (e.g. "Approve", "Move to Interview") */
  transitionName: string;
  /** Label of the target state */
  toStateLabel: string;
  /** Whether the confirm action is in progress */
  isPending?: boolean;
  /** Picklist options for the reason field */
  reasonOptions?: string[] | null;
  /** Whether a reason must be selected */
  reasonRequired?: boolean;
  /** Whether a comment must be entered */
  commentRequired?: boolean;
  /** Preflight messages surfaced by advisory guards. Blockers disable the
   * confirm button; warnings are informational so the user acknowledges the
   * cost of the transition (e.g. "N filings will be cancelled"). Whichever
   * parent wires this up is responsible for fetching preflight when the
   * dialog opens — dialog itself stays presentational. */
  warnings?: string[];
  blockers?: string[];
  /** If true, preflight is still loading — hide banners and disable confirm
   * so we never let the user commit before we know whether it's safe. */
  preflightLoading?: boolean;
  /** Called with the optional reason and comment when the user confirms */
  onConfirm: (data: { reason?: string; comment?: string }) => void;
}

export function TransitionConfirmDialog({
  open,
  onOpenChange,
  transitionName,
  toStateLabel,
  isPending,
  reasonOptions,
  reasonRequired,
  commentRequired,
  warnings,
  blockers,
  preflightLoading,
  onConfirm,
}: TransitionConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setComment('');
    }
  }, [open]);

  const hasReasonOptions = reasonOptions && reasonOptions.length > 0;
  const isReasonValid = !reasonRequired || !!reason;
  const isCommentValid = !commentRequired || !!comment.trim();
  const hasBlockers = (blockers?.length ?? 0) > 0;
  const canSubmit = isReasonValid && isCommentValid && !hasBlockers && !preflightLoading;
  const hasWarnings = (warnings?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transitionName}</DialogTitle>
          <DialogDescription>
            Transition to <span className="font-medium text-foreground">{toStateLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {preflightLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking preconditions…
            </div>
          )}

          {hasBlockers && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <ShieldAlert className="h-4 w-4" />
                This transition cannot proceed
              </div>
              <ul className="list-disc pl-5 text-sm text-destructive space-y-1">
                {blockers!.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings && !hasBlockers && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                Heads up
              </div>
              <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-400 space-y-1">
                {warnings!.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {hasReasonOptions && (
            <div>
              <label htmlFor="transition-reason" className="text-sm font-medium text-foreground">
                Reason {reasonRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
              </label>
              <select
                id="transition-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a reason...</option>
                {reasonOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="transition-comment" className="text-sm font-medium text-foreground">
              Comment {commentRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
            </label>
            <textarea
              id="transition-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add a note about this transition..."
              className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({
              reason: reason || undefined,
              comment: comment.trim() || undefined,
            })}
            disabled={isPending || !canSubmit}
          >
            {isPending ? 'Transitioning...' : transitionName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
