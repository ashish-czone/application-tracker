import { useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Checkbox,
  Form,
  FormTextarea,
  RadioGroup,
  RadioGroupItem,
  AvatarBadge,
} from '@packages/ui';
import type { Handler } from '../../../../../types';
import type { FilingRow } from '../types';

export interface BulkReassignSubmitPayload {
  newHandlerId: string;
  notify: boolean;
  note: string;
}

export interface BulkReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rows the user is about to reassign. Full rows, not just ids —
   *  needed to derive the current-handler breakdown shown to the user. */
  filings: FilingRow[];
  /** Available handlers. */
  handlers: Handler[];
  /** Called when the user confirms. Consumer applies the change. */
  onConfirm: (payload: BulkReassignSubmitPayload) => void;
}

const UNASSIGNED = '__unassigned__';

const schema = z.object({
  newHandlerId: z.string().min(1, 'Select a handler'),
  notify: z.boolean(),
  note: z.string(),
});
type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { newHandlerId: '', notify: true, note: '' };

export function BulkReassignDialog({
  open,
  onOpenChange,
  filings,
  handlers,
  onConfirm,
}: BulkReassignDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const count = filings.length;

  // Reset whenever the dialog re-opens so each open starts clean.
  useEffect(() => {
    if (open) form.reset(DEFAULTS);
  }, [open, form]);

  // Current-handler breakdown — shows "Priya (7) • Unassigned (3) • +1".
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of filings) {
      const key = f.handler?.id ?? UNASSIGNED;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const entries = Array.from(map.entries()).map(([id, n]) => {
      if (id === UNASSIGNED) return { id, label: 'Unassigned', count: n };
      const h = handlers.find((x) => x.id === id);
      return { id, label: h?.name.split(' ')[0] ?? 'Unknown', count: n };
    });
    entries.sort((a, b) => b.count - a.count);
    return entries;
  }, [filings, handlers]);

  const onSubmit = (values: FormValues) => {
    if (count === 0) return;
    onConfirm({ ...values, note: values.note.trim() });
    form.reset(DEFAULTS);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset(DEFAULTS);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign {count} {count === 1 ? 'filing' : 'filings'}</DialogTitle>
          <DialogDescription>
            Choose a new handler. Current assignments will be overwritten.
          </DialogDescription>
        </DialogHeader>

        <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
          {/* Current-handler breakdown */}
          <div className="border border-rule bg-paper-sunken/40 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.14em] font-sans font-semibold text-ink-muted mb-1.5">
              Current assignees
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink">
              {breakdown.map((entry, idx) => (
                <span key={entry.id} className="inline-flex items-center gap-1">
                  <span className="font-sans">{entry.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-ink-muted">({entry.count})</span>
                  {idx < breakdown.length - 1 && (
                    <span aria-hidden className="text-ink-muted/50 ml-2">•</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* New handler picker */}
          <Controller
            control={form.control}
            name="newHandlerId"
            render={({ field, fieldState }) => (
              <fieldset>
                <legend className="text-[10px] uppercase tracking-[0.14em] font-sans font-semibold text-ink-muted mb-2">
                  New handler
                </legend>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="border border-rule divide-y divide-rule/60 max-h-[240px] overflow-y-auto block gap-0"
                >
                  {handlers.map((h) => {
                    const active = h.id === field.value;
                    return (
                      <label
                        key={h.id}
                        className={
                          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ' +
                          (active ? 'bg-ink/5' : 'hover:bg-paper-sunken/40')
                        }
                      >
                        <RadioGroupItem value={h.id} className="w-3.5 h-3.5" />
                        <AvatarBadge initials={h.initials} size="md" />
                        <span className="flex-1 min-w-0">
                          <div className="text-sm text-ink font-sans truncate">{h.name}</div>
                          {h.role && (
                            <div className="text-[11px] text-ink-muted font-sans truncate">{h.role}</div>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
                {fieldState.error && (
                  <p className="text-[11px] text-destructive mt-1.5 font-sans" aria-live="polite">
                    {fieldState.error.message}
                  </p>
                )}
              </fieldset>
            )}
          />

          {/* Options */}
          <div className="space-y-3">
            <Controller
              control={form.control}
              name="notify"
              render={({ field }) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                  <span className="text-sm text-ink font-sans">Notify new handler</span>
                </label>
              )}
            />

            <FormTextarea
              name="note"
              label="Note (optional)"
              rows={2}
              placeholder="Context for the new handler (appears in activity log)…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={count === 0}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              Reassign {count} {count === 1 ? 'filing' : 'filings'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
