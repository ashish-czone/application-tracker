import { useState, useEffect } from 'react';
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
  /** Called with the optional comment when the user confirms */
  onConfirm: (comment?: string) => void;
}

export function TransitionConfirmDialog({
  open,
  onOpenChange,
  transitionName,
  toStateLabel,
  isPending,
  onConfirm,
}: TransitionConfirmDialogProps) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) setComment('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transitionName}</DialogTitle>
          <DialogDescription>
            Transition to <span className="font-medium text-foreground">{toStateLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label htmlFor="transition-comment" className="text-sm font-medium text-foreground">
            Comment <span className="text-muted-foreground font-normal">(optional)</span>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(comment.trim() || undefined)} disabled={isPending}>
            {isPending ? 'Transitioning...' : transitionName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
