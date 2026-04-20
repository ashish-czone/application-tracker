import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import { useUpdateCategory, type UpdateCategoryRequest } from '@packages/taxonomy-ui';

export interface EditItemDialogItem {
  id: string;
  name: string;
  slug: string;
  metadata: Record<string, string>;
}

export interface EditItemDialogProps {
  item: EditItemDialogItem;
  onClose: () => void;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface MetadataRow {
  key: string;
  value: string;
}

function metadataToRows(meta: Record<string, string>): MetadataRow[] {
  return Object.entries(meta).map(([key, value]) => ({ key, value }));
}

function rowsToMetadata(rows: MetadataRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim().toLowerCase();
    if (k.length === 0) continue;
    out[k] = r.value;
  }
  return out;
}

function shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function EditItemDialog({ item, onClose }: EditItemDialogProps) {
  const [name, setName] = useState(item.name);
  const [slug, setSlug] = useState(item.slug);
  const [metadataRows, setMetadataRows] = useState<MetadataRow[]>(() => metadataToRows(item.metadata));
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const mutation = useUpdateCategory({ onSuccess: onClose });

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

  const handleMetadataKey = (index: number, key: string) => {
    setMetadataRows((prev) => prev.map((r, i) => (i === index ? { ...r, key } : r)));
  };

  const handleMetadataValue = (index: number, value: string) => {
    setMetadataRows((prev) => prev.map((r, i) => (i === index ? { ...r, value } : r)));
  };

  const handleMetadataRemove = (index: number) => {
    setMetadataRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMetadataAdd = () => {
    setMetadataRows((prev) => [...prev, { key: '', value: '' }]);
  };

  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<string>();
    for (const r of metadataRows) {
      const k = r.key.trim().toLowerCase();
      if (k.length === 0) continue;
      const count = (seen.get(k) ?? 0) + 1;
      seen.set(k, count);
      if (count > 1) dupes.add(k);
    }
    return dupes;
  }, [metadataRows]);

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
    if (duplicateKeys.size > 0) hasError = true;
    if (hasError) return;

    const nextMetadata = rowsToMetadata(metadataRows);

    const data: UpdateCategoryRequest = {};
    if (trimmedName !== item.name) data.name = trimmedName;
    if (trimmedSlug !== item.slug) data.slug = trimmedSlug;
    if (!shallowEqual(nextMetadata, item.metadata)) data.metadata = nextMetadata;

    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }

    mutation.mutate({ id: item.id, data });
  };

  const isSubmitting = mutation.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-item-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onMouseDown={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-paper-raised paper-grain border border-rule shadow-xl max-h-[90vh] flex flex-col"
      >
        <header className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-rule">
          <div>
            <Eyebrow tone="muted" mark="§">
              Edit item
            </Eyebrow>
            <h2
              id="edit-item-dialog-title"
              className="mt-1.5 font-serif text-2xl text-ink leading-tight"
            >
              {item.name}
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

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-5 space-y-5 overflow-y-auto">
            <div>
              <label
                htmlFor="edit-item-name"
                className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
              >
                Name
              </label>
              <input
                ref={nameRef}
                id="edit-item-name"
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
              <label
                htmlFor="edit-item-slug"
                className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5"
              >
                Slug
              </label>
              <input
                id="edit-item-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugError(null);
                }}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-rule bg-paper text-sm font-mono tabular-nums text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
              />
              {slugError ? (
                <p className="mt-1.5 text-[11px] font-sans text-destructive">{slugError}</p>
              ) : (
                <p className="mt-1.5 text-[11px] font-sans text-ink-muted">
                  Changing the slug may break fields that bind to this item by slug.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="block text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
                  Metadata
                </span>
                <button
                  type="button"
                  onClick={handleMetadataAdd}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 text-[11px] uppercase tracking-eyebrow font-sans text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" strokeWidth={2} />
                  Add
                </button>
              </div>
              {metadataRows.length === 0 ? (
                <p className="text-[11px] font-sans text-ink-muted italic">
                  No metadata. Add key/value pairs to enrich this item.
                </p>
              ) : (
                <div className="space-y-2">
                  {metadataRows.map((row, index) => {
                    const normalizedKey = row.key.trim().toLowerCase();
                    const isDuplicate = normalizedKey.length > 0 && duplicateKeys.has(normalizedKey);
                    return (
                      <div key={index} className="flex items-start gap-2">
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => handleMetadataKey(index, e.target.value)}
                          placeholder="key"
                          disabled={isSubmitting}
                          className={`flex-1 min-w-0 px-2.5 py-1.5 border bg-paper text-[12px] font-mono tabular-nums text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed ${
                            isDuplicate ? 'border-destructive' : 'border-rule'
                          }`}
                        />
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => handleMetadataValue(index, e.target.value)}
                          placeholder="value"
                          disabled={isSubmitting}
                          className="flex-1 min-w-0 px-2.5 py-1.5 border border-rule bg-paper text-[12px] font-sans text-ink placeholder:text-ink-muted outline-none focus:border-ink transition-colors disabled:bg-paper-sunken disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => handleMetadataRemove(index)}
                          disabled={isSubmitting}
                          className="flex-shrink-0 p-1.5 text-ink-muted hover:text-destructive transition-colors disabled:opacity-50"
                          aria-label="Remove metadata row"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    );
                  })}
                  {duplicateKeys.size > 0 && (
                    <p className="text-[11px] font-sans text-destructive">
                      Duplicate keys are not allowed. Keys are normalized to lowercase.
                    </p>
                  )}
                </div>
              )}
            </div>

            {mutation.isError && (
              <div className="px-3 py-2 border border-destructive/30 bg-destructive/5 text-[12px] font-sans text-destructive">
                {(mutation.error as { body?: { message?: string } })?.body?.message ??
                  'Failed to update item. Please try again.'}
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
