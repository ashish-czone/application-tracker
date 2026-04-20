import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import {
  useCreateCategory,
  type CategoryGroup,
  type CategoryTreeNode,
} from '@packages/taxonomy-ui';

export interface AddItemDialogProps {
  group: CategoryGroup;
  tree: CategoryTreeNode[];
  isHierarchical: boolean;
  onClose: () => void;
}

interface FlatOption {
  id: string;
  label: string;
  depth: number;
}

function flattenForParentSelect(nodes: CategoryTreeNode[], depth = 0, acc: FlatOption[] = []): FlatOption[] {
  for (const n of nodes) {
    acc.push({ id: n.id, label: n.name, depth });
    if (n.children.length > 0) flattenForParentSelect(n.children, depth + 1, acc);
  }
  return acc;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function AddItemDialog({ group, tree, isHierarchical, onClose }: AddItemDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const parentOptions = useMemo(() => flattenForParentSelect(tree), [tree]);

  const mutation = useCreateCategory({ onSuccess: onClose });

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

    let hasError = false;
    if (trimmedName.length === 0) {
      setNameError('Name is required');
      hasError = true;
    }
    if (trimmedSlug.length === 0) {
      setSlugError('Slug is required');
      hasError = true;
    } else if (!SLUG_PATTERN.test(trimmedSlug)) {
      setSlugError('Slug must be lowercase kebab-case (e.g. north-america)');
      hasError = true;
    }
    if (hasError) return;

    mutation.mutate({
      groupId: group.id,
      data: {
        name: trimmedName,
        slug: trimmedSlug,
        ...(parentId ? { parentId } : {}),
      },
    });
  };

  const isSubmitting = mutation.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-item-dialog-title"
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
              Add to {group.name}
            </Eyebrow>
            <h2
              id="add-item-dialog-title"
              className="mt-1.5 font-serif text-2xl text-ink leading-tight"
            >
              New item
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
                htmlFor="add-item-name"
                className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
              >
                Name
              </label>
              <input
                ref={nameRef}
                id="add-item-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. United States"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
              />
              {nameError && (
                <p className="mt-1.5 text-[11px] font-sans text-destructive">{nameError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="add-item-slug"
                className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
              >
                Slug
              </label>
              <input
                id="add-item-slug"
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
                  Lowercase, kebab-case. Used in the URL and by fields that bind to this set.
                </p>
              )}
            </div>

            {isHierarchical && parentOptions.length > 0 && (
              <div>
                <label
                  htmlFor="add-item-parent"
                  className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
                >
                  Parent
                </label>
                <select
                  id="add-item-parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-rule bg-paper text-sm font-sans text-ink outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
                >
                  <option value="">— top level —</option>
                  {parentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {'\u00A0\u00A0'.repeat(opt.depth)}
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mutation.isError && (
              <div className="px-3 py-2 border border-destructive/30 bg-destructive/5 text-[12px] font-sans text-destructive">
                {(mutation.error as { body?: { message?: string } })?.body?.message ??
                  'Failed to create item. Please try again.'}
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
              Add item
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
