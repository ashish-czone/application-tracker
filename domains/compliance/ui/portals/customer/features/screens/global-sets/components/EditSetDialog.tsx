import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Lock } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import { useUpdateCategoryGroup, type UpdateCategoryGroupRequest } from '@packages/taxonomy-ui';

export interface EditSetDialogSet {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface EditSetDialogProps {
  set: EditSetDialogSet;
  onClose: () => void;
}

export function EditSetDialog({ set, onClose }: EditSetDialogProps) {
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description ?? '');
  const [nameError, setNameError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const mutation = useUpdateCategoryGroup({ onSuccess: onClose });

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }

    const data: UpdateCategoryGroupRequest = {};
    if (trimmedName !== set.name) data.name = trimmedName;

    const nextDescription = trimmedDescription.length > 0 ? trimmedDescription : '';
    const currentDescription = set.description ?? '';
    if (nextDescription !== currentDescription) data.description = nextDescription;

    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }

    mutation.mutate({ id: set.id, data });
  };

  const isSubmitting = mutation.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-set-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onMouseDown={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-paper-raised paper-grain border border-rule shadow-xl"
      >
        <header className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-rule">
          <div>
            <Eyebrow tone="muted" mark="§">
              Edit set
            </Eyebrow>
            <h2
              id="edit-set-dialog-title"
              className="mt-1.5 font-serif text-2xl text-ink leading-tight"
            >
              {set.name}
            </h2>
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

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div>
              <label
                htmlFor="edit-set-name"
                className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
              >
                Name
              </label>
              <input
                ref={nameRef}
                id="edit-set-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
              />
              {nameError && (
                <p className="mt-1.5 text-[11px] font-sans text-destructive">{nameError}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5">
                Slug
              </label>
              <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken text-sm font-mono tabular-nums text-ink-soft">
                <Lock className="w-3 h-3 text-ink-muted" strokeWidth={1.5} />
                <span>{set.slug}</span>
              </div>
              <p className="mt-1.5 text-[11px] font-sans text-ink-muted">
                Slugs cannot be changed — fields across the platform bind to this set by slug.
              </p>
            </div>

            <div>
              <label
                htmlFor="edit-set-description"
                className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
              >
                Description
                <span className="ml-1.5 text-ink-muted/70 lowercase tracking-normal">(optional)</span>
              </label>
              <textarea
                id="edit-set-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this set represent?"
                rows={3}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed resize-none"
              />
            </div>

            {mutation.isError && (
              <div className="px-3 py-2 border border-destructive/30 bg-destructive/5 text-[12px] font-sans text-destructive">
                {(mutation.error as { body?: { message?: string } })?.body?.message ??
                  'Failed to update set. Please try again.'}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule bg-paper">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-2 border border-rule bg-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink hover:bg-paper transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-3 py-2 bg-ink text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium hover:bg-ink/90 transition-colors disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />}
              Save changes
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
