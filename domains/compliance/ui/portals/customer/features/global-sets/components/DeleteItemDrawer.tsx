import { useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { DrawerShell, DrawerHeader, Eyebrow } from '@packages/ui';
import { useDeleteCategory } from '@packages/taxonomy-ui';

export interface DeleteItemDrawerItem {
  id: string;
  name: string;
  slug: string;
  childCount: number;
}

export interface DeleteItemDrawerProps {
  item: DeleteItemDrawerItem;
  onClose: () => void;
}

export function DeleteItemDrawer({ item, onClose }: DeleteItemDrawerProps) {
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
    <DrawerShell onClose={onClose} width="md">
      <div className="flex flex-col h-full">
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">Delete item</Eyebrow>}
          title={item.name}
          subtitle={item.slug}
          onClose={onClose}
          titleSize="sm"
        />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
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

        <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule bg-paper flex-none">
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
    </DrawerShell>
  );
}
