import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
  Checkbox,
} from '@packages/ui';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  useDeprecateRule,
  useRuleDeprecationPreview,
} from '../../../../../hooks/useComplianceRulesApi';

interface RuleDeprecationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId: string;
  /** "GST-M — GST Monthly" style label so the copy is grounded. */
  ruleLabel: string;
  onDeprecated?: () => void;
}

export function RuleDeprecationDialog({
  open,
  onOpenChange,
  ruleId,
  ruleLabel,
  onDeprecated,
}: RuleDeprecationDialogProps) {
  const [alsoCancelInFlight, setAlsoCancelInFlight] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setAlsoCancelInFlight(false);
      setComment('');
    }
  }, [open]);

  const previewRuleId = open ? ruleId : null;
  const { data: preview, isFetching: previewLoading, isError: previewError } =
    useRuleDeprecationPreview(previewRuleId);

  const mutation = useDeprecateRule({
    onSuccess: () => {
      onOpenChange(false);
      onDeprecated?.();
    },
  });

  const canSubmit = !mutation.isPending && !previewLoading;

  const handleConfirm = () => {
    if (!canSubmit) return;
    mutation.mutate({
      ruleId,
      alsoCancelInFlight,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deprecate rule</DialogTitle>
          <DialogDescription>
            Stop generating new filings for{' '}
            <span className="font-medium text-foreground">{ruleLabel}</span>.
            Existing filings stay open unless you opt in below.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-md border border-rule bg-paper-raised p-3 min-h-[64px]">
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Counting in-flight filings…
              </div>
            )}
            {previewError && !previewLoading && (
              <p className="text-sm text-destructive">
                Couldn't load preview. Try closing and reopening the dialog.
              </p>
            )}
            {preview && !previewLoading && !previewError && (
              <PreviewBody inFlightFilingCount={preview.inFlightFilingCount} />
            )}
          </div>

          {preview && preview.inFlightFilingCount > 0 && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={alsoCancelInFlight}
                onCheckedChange={(v) => setAlsoCancelInFlight(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                Also cancel the {preview.inFlightFilingCount} in-flight filing
                {preview.inFlightFilingCount === 1 ? '' : 's'} for this rule.
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Off by default. Turn on only if the firm will not complete
                  these filings — e.g. the rule was issued in error.
                </span>
              </span>
            </label>
          )}

          <div>
            <Label htmlFor="deprecation-comment">
              Comment <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              id="deprecation-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Context for the audit trail — e.g. replaced by a newer rule."
              className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canSubmit}>
            {mutation.isPending ? 'Deprecating…' : 'Deprecate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ inFlightFilingCount }: { inFlightFilingCount: number }) {
  if (inFlightFilingCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No in-flight filings for this rule. Only the rule itself will be
        deprecated.
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <span>
        <span className="font-medium">{inFlightFilingCount}</span> in-flight
        filing{inFlightFilingCount === 1 ? '' : 's'} will stay open by default.
      </span>
    </div>
  );
}
