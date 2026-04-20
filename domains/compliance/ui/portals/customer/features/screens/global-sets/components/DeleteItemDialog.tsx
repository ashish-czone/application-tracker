import { useEffect, useRef } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import { useDeleteCategory } from '@packages/taxonomy-ui';

export interface DeleteItemDialogItem {
  id: string;
  name: string;
  slug: string;
  childCount: number;
}

export interface DeleteItemDialogProps {
  item: DeleteItemDialogItem;
  onClose: () => void;
}

export function DeleteItemDialog({ item, onClose }: DeleteItemDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const mutation = useDeleteCategory({ onSuccess: onClose });

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDelete = () => {
    mutation.mutate(item.id);
  };

  const isSubmitting = mutation.isPending;
  const hasChildren = item.childCount > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-item-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onMouseDown={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md bg-paper-raised paper-grain border border-rule shadow-xl"
      >
        <header className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-rule">
          <div>
            <Eyebrow tone="muted" mark="§">
              Delete item
            </Eyebrow>
            <h2
              id="delete-item-dialog-title"
              className="mt-1.5 font-serif text-2xl text-ink leading-tight"
            >
              {item.name}
            </h2>
            <div className="mt-1 font-mono text-[11px] text-ink-muted tabular-nums">
              {item.slug}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          <p className="text-[13px] font-sans text-ink-soft">
            This action cannot be undone. Fields that bind to this item by slug will no longer
            resolve.
          </p>

          {hasChildren && (
            <div className="flex items-start gap-2 px-3 py-2.5 border border-destructive/30 bg-destructive/5">
              <AlertTriangle
                className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5"
                strokeWidth={1.5}
              />
              <p className="text-[12px] font-sans text-destructive">
                This item has {item.childCount} child{item.childCount === 1 ? '' : 'ren'}. They
                will be deleted as well.
              </p>
            </div>
          )}

          {mutation.isError && (
            <div className="px-3 py-2 border border-destructive/30 bg-destructive/5 text-[12px] font-sans text-destructive">
              {(mutation.error as { body?: { message?: string } })?.body?.message ??
                'Failed to delete item. Please try again.'}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule bg-paper">
          <button
            ref={cancelRef}
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
            disabled={isSubmitting}
            className="flex items-center gap-2 px-3 py-2 bg-destructive text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />}
            Delete item
          </button>
        </footer>
      </div>
    </div>
  );
}
