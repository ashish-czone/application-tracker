import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Combobox, DrawerShell, DrawerHeader, Eyebrow, type ComboboxOption } from '@packages/ui';
import {
  useCreateCategory,
  type CategoryGroup,
  type CategoryTreeNode,
} from '@packages/taxonomy-ui';

export interface AddItemDrawerProps {
  group: CategoryGroup;
  tree: CategoryTreeNode[];
  isHierarchical: boolean;
  onClose: () => void;
}

function flattenForParentSelect(
  nodes: CategoryTreeNode[],
  trail: string[] = [],
  acc: ComboboxOption[] = [],
): ComboboxOption[] {
  for (const n of nodes) {
    const path = [...trail, n.name];
    acc.push({ value: n.id, label: path.join(' › ') });
    if (n.children.length > 0) flattenForParentSelect(n.children, path, acc);
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

export function AddItemDrawer({ group, tree, isHierarchical, onClose }: AddItemDrawerProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

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
    <DrawerShell onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <DrawerHeader
          eyebrow={<Eyebrow tone="muted" mark="§">Add to {group.name}</Eyebrow>}
          title="New item"
          subtitle="Add an entry to this set. Fields bind by slug."
          onClose={onClose}
          titleSize="sm"
        />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
              <Combobox
                id="add-item-parent"
                value={parentId}
                onChange={setParentId}
                options={parentOptions}
                placeholder="— top level —"
                searchPlaceholder="Search parents..."
                disabled={isSubmitting}
                className="h-auto rounded-none border-rule bg-paper px-3 py-2 font-sans text-ink focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-ink data-[placeholder]:text-ink-muted"
              />
              <p className="mt-1.5 text-[11px] font-sans text-ink-muted">
                Leave empty to create at the top level.
              </p>
            </div>
          )}

          {mutation.isError && (
            <div className="px-3 py-2 border border-destructive/30 bg-destructive/5 text-[12px] font-sans text-destructive">
              {(mutation.error as { body?: { message?: string } })?.body?.message ??
                'Failed to create item. Please try again.'}
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
            Add item
          </button>
        </footer>
      </form>
    </DrawerShell>
  );
}
