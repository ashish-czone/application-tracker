import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { DrawerShell, DrawerHeader, Eyebrow } from '@packages/ui';
import { useDeleteCategoryGroup } from '@packages/taxonomy-ui';

export interface DeleteSetDrawerSet {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
  usedByFields: number;
}

export interface DeleteSetDrawerProps {
  set: DeleteSetDrawerSet;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteSetDrawer({ set, onClose, onDeleted }: DeleteSetDrawerProps) {
  const [confirm, setConfirm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useDeleteCategoryGroup({
    onSuccess: () => {
      onDeleted?.();
      onClose();
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDelete = () => {
    mutation.mutate(set.id);
  };

  const isSubmitting = mutation.isPending;
  const matches = confirm.trim() === set.slug;

  return (
    <DrawerShell onClose={onClose} width="md">
      <div className="flex flex-col h-full">
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">Delete set</Eyebrow>}
          title={set.name}
          subtitle={set.slug}
          onClose={onClose}
          titleSize="sm"
        />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-[13px] font-sans text-ink-soft">
            Deleting a set is permanent. All items in the set will be removed.
          </p>

          {(set.itemCount > 0 || set.usedByFields > 0) && (
            <div className="flex items-start gap-2 px-3 py-2.5 border border-destructive/30 bg-destructive/5">
              <AlertTriangle
                className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5"
                strokeWidth={1.5}
              />
              <div className="space-y-1 text-[12px] font-sans text-destructive">
                {set.itemCount > 0 && (
                  <p>
                    {set.itemCount} item{set.itemCount === 1 ? '' : 's'} will be deleted with this
                    set.
                  </p>
                )}
                {set.usedByFields > 0 && (
                  <p>
                    {set.usedByFields} field{set.usedByFields === 1 ? '' : 's'} bind to{' '}
                    <span className="font-mono">{set.slug}</span> and will stop resolving.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="delete-set-confirm"
              className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
            >
              Type <span className="font-mono normal-case tracking-normal text-ink">{set.slug}</span>{' '}
              to confirm
            </label>
            <input
              ref={inputRef}
              id="delete-set-confirm"
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-rule bg-paper text-sm font-mono tabular-nums text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
              autoComplete="off"
            />
          </div>

          {mutation.isError && (
            <div className="px-3 py-2 border border-destructive/30 bg-destructive/5 text-[12px] font-sans text-destructive">
              {(mutation.error as { body?: { message?: string } })?.body?.message ??
                'Failed to delete set. Please try again.'}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule bg-paper flex-none">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-2 border border-rule bg-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink hover:bg-paper transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting || !matches}
            className="flex items-center gap-2 px-3 py-2 bg-destructive text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium hover:bg-destructive/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />}
            Delete set
          </button>
        </footer>
      </div>
    </DrawerShell>
  );
}
