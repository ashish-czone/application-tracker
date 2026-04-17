import { useMemo, useState } from 'react';
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
} from '@packages/ui';
import type { Handler } from '../../../../../shared/types';
import type { FilingRow } from './filingsMock';

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

export function BulkReassignDialog({
  open,
  onOpenChange,
  filings,
  handlers,
  onConfirm,
}: BulkReassignDialogProps) {
  const [newHandlerId, setNewHandlerId] = useState<string>('');
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState('');

  // Reset local form whenever the dialog re-opens with a different row set.
  const count = filings.length;

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

  const canSubmit = newHandlerId.length > 0 && count > 0;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({ newHandlerId, notify, note: note.trim() });
    // Reset form; parent controls open state.
    setNewHandlerId('');
    setNote('');
    setNotify(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset on close so the next open starts clean.
      setNewHandlerId('');
      setNote('');
      setNotify(true);
    }
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
        <fieldset>
          <legend className="text-[10px] uppercase tracking-[0.14em] font-sans font-semibold text-ink-muted mb-2">
            New handler
          </legend>
          <div className="border border-rule divide-y divide-rule/60 max-h-[240px] overflow-y-auto">
            {handlers.map((h) => {
              const active = h.id === newHandlerId;
              return (
                <label
                  key={h.id}
                  className={
                    'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ' +
                    (active ? 'bg-ink/5' : 'hover:bg-paper-sunken/40')
                  }
                >
                  <input
                    type="radio"
                    name="new-handler"
                    value={h.id}
                    checked={active}
                    onChange={() => setNewHandlerId(h.id)}
                    className="w-3.5 h-3.5 accent-ink"
                  />
                  <span
                    aria-hidden
                    className="w-7 h-7 bg-authority text-paper-raised text-[10px] font-sans font-semibold flex items-center justify-center flex-none"
                  >
                    {h.initials}
                  </span>
                  <span className="flex-1 min-w-0">
                    <div className="text-sm text-ink font-sans truncate">{h.name}</div>
                    {h.role && (
                      <div className="text-[11px] text-ink-muted font-sans truncate">{h.role}</div>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
            />
            <span className="text-sm text-ink font-sans">Notify new handler</span>
          </label>

          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-sans font-semibold text-ink-muted mb-1.5">
              Note <span className="text-ink-muted/70 normal-case tracking-normal font-normal">(optional)</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Context for the new handler (appears in activity log)…"
              className="w-full border border-rule bg-paper-raised px-3 py-2 text-sm text-ink font-sans placeholder:text-ink-muted focus:outline-none focus:border-ink transition-colors resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            <UserPlus className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
            Reassign {count} {count === 1 ? 'filing' : 'filings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
