import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DrawerShell, DrawerHeader, Eyebrow } from '@packages/ui';
import { useCreateCategoryGroup } from '@packages/taxonomy-ui';

export interface NewSetDrawerProps {
  onClose: () => void;
  onCreated?: (id: string) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function NewSetDrawer({ onClose, onCreated }: NewSetDrawerProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  const mutation = useCreateCategoryGroup({
    onSuccess: () => {
      onClose();
    },
  });

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(null);
    if (!slugTouched) {
      setSlug(slugify(value));
      setSlugError(null);
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugTouched(true);
    setSlugError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    const trimmedDescription = description.trim();

    let hasError = false;
    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      hasError = true;
    }
    if (trimmedSlug.length < 2) {
      setSlugError('Slug must be at least 2 characters');
      hasError = true;
    } else if (!SLUG_PATTERN.test(trimmedSlug)) {
      setSlugError('Slug must be lowercase kebab-case (e.g. countries)');
      hasError = true;
    }
    if (hasError) return;

    mutation.mutate(
      {
        name: trimmedName,
        slug: trimmedSlug,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      },
      {
        onSuccess: (created) => {
          if (created && typeof created === 'object' && 'id' in created) {
            onCreated?.((created as { id: string }).id);
          }
        },
      },
    );
  };

  const isSubmitting = mutation.isPending;

  return (
    <DrawerShell onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">New global set</Eyebrow>}
          title="Define a new set"
          subtitle="Reference list shared across the platform. Fields bind by slug."
          onClose={onClose}
          titleSize="sm"
        />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label
              htmlFor="new-set-name"
              className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
            >
              Name
            </label>
            <input
              ref={nameRef}
              id="new-set-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Countries"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
            />
            {nameError && (
              <p className="mt-1.5 text-[11px] font-sans text-destructive">{nameError}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="new-set-slug"
              className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
            >
              Slug
            </label>
            <input
              id="new-set-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="auto-derived-from-name"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-rule bg-paper text-sm font-mono tabular-nums text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
            />
            {slugError ? (
              <p className="mt-1.5 text-[11px] font-sans text-destructive">{slugError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] font-sans text-ink-muted">
                Lowercase, kebab-case. Fields bind to this set by slug — choose carefully.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="new-set-description"
              className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
            >
              Description
              <span className="ml-1.5 text-ink-muted/70 lowercase tracking-normal">(optional)</span>
            </label>
            <textarea
              id="new-set-description"
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
                'Failed to create set. Please try again.'}
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
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-3 py-2 bg-ink text-paper-raised text-[11px] uppercase tracking-eyebrow font-sans font-medium hover:bg-ink/90 transition-colors disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />}
            Create set
          </button>
        </footer>
      </form>
    </DrawerShell>
  );
}
