import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
} from '@packages/ui';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  useDeactivateRegistration,
  useRegistrationDeactivationPreview,
} from '../../../../../hooks/useClientsApi';

interface RegistrationDeactivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  lawId: string;
  /** Display label for the law (e.g. "GST") so the dialog copy is grounded. */
  lawLabel: string;
  onDeactivated?: () => void;
}

/** `YYYY-MM-DD` for today, used as both the default and the max of the date input. */
function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RegistrationDeactivationDialog({
  open,
  onOpenChange,
  clientId,
  lawId,
  lawLabel,
  onDeactivated,
}: RegistrationDeactivationDialogProps) {
  const today = useMemo(todayYMD, []);
  const [date, setDate] = useState<string>(today);
  const [alsoCancelEarlier, setAlsoCancelEarlier] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setDate(today);
      setAlsoCancelEarlier(false);
      setComment('');
    }
  }, [open, today]);

  const previewParams = open && date ? { clientId, lawId, date } : null;
  const { data: preview, isFetching: previewLoading, isError: previewError } =
    useRegistrationDeactivationPreview(previewParams);

  const mutation = useDeactivateRegistration({
    onSuccess: () => {
      onOpenChange(false);
      onDeactivated?.();
    },
  });

  const dateInvalid = !date || date > today;
  const canSubmit = !dateInvalid && !mutation.isPending && !previewLoading;

  const handleConfirm = () => {
    if (!canSubmit) return;
    mutation.mutate({
      clientId,
      lawId,
      // Serialize at day boundary UTC — the service-side past-or-today check
      // compares to Date.now(), so an "end of day" time is safer than "start
      // of day" when the admin picks today in a local timezone east of UTC.
      deactivatedAt: new Date(`${date}T23:59:59Z`).toISOString(),
      alsoCancelEarlier,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate registration</DialogTitle>
          <DialogDescription>
            Stop generating new filings for{' '}
            <span className="font-medium text-foreground">{lawLabel}</span> and
            optionally clean up existing ones.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="deactivation-date">Effective date</Label>
            <Input
              id="deactivation-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
            {dateInvalid && (
              <p className="mt-1 text-xs text-destructive">
                Pick today or a past date.
              </p>
            )}
          </div>

          <div className="rounded-md border border-rule bg-paper-raised p-3 min-h-[64px]">
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Counting affected filings…
              </div>
            )}
            {previewError && !previewLoading && (
              <p className="text-sm text-destructive">
                Couldn't load preview. Try again or pick a different date.
              </p>
            )}
            {preview && !previewLoading && !previewError && (
              <PreviewBody
                cancelledAfter={preview.cancelledAfter}
                remainingBefore={preview.remainingBefore}
              />
            )}
          </div>

          {preview && preview.remainingBefore > 0 && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={alsoCancelEarlier}
                onCheckedChange={(v) => setAlsoCancelEarlier(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                Also cancel the {preview.remainingBefore} open filing
                {preview.remainingBefore === 1 ? '' : 's'} for earlier periods.
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Off by default. Turn on only if the firm will not complete
                  those filings.
                </span>
              </span>
            </label>
          )}

          <div>
            <Label htmlFor="deactivation-comment">
              Comment <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              id="deactivation-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Context for the audit trail — e.g. client engagement ended on this date."
              className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canSubmit}>
            {mutation.isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  cancelledAfter,
  remainingBefore,
}: {
  cancelledAfter: number;
  remainingBefore: number;
}) {
  const both = cancelledAfter === 0 && remainingBefore === 0;
  if (both) {
    return (
      <p className="text-sm text-muted-foreground">
        No open filings for this registration. Only the registration itself
        will be deactivated.
      </p>
    );
  }
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <span>
          <span className="font-medium">{cancelledAfter}</span> filing
          {cancelledAfter === 1 ? '' : 's'} after this date will auto-cancel.
        </span>
      </div>
      <div className="text-muted-foreground">
        <span className="font-medium text-foreground">{remainingBefore}</span>{' '}
        filing{remainingBefore === 1 ? '' : 's'} for earlier periods remain
        open by default.
      </div>
    </div>
  );
}
