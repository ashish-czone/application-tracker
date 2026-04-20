import { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export interface FlatRowItem {
  id: string;
  slug: string;
  name: string;
  metadata: Record<string, string>;
}

export interface FlatRowsProps {
  items: FlatRowItem[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function FlatRows({ items, onEdit, onDelete }: FlatRowsProps) {
  const metadataKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((it) => {
      Object.keys(it.metadata).forEach((k) => keys.add(k));
    });
    return Array.from(keys);
  }, [items]);

  const hasActions = !!(onEdit || onDelete);

  return (
    <>
      {items.map((item) => (
        <div
          key={item.id}
          className="group grid items-center gap-3 px-4 py-2.5 border-b border-rule hover:bg-paper transition-colors"
          style={{
            gridTemplateColumns: `1fr 120px ${metadataKeys.map(() => '1fr').join(' ') || '0fr'}${hasActions ? ' 64px' : ''}`,
          }}
        >
          <div className="text-xs text-ink font-sans">{item.name}</div>
          <div className="font-mono text-[11px] text-ink-muted tabular-nums">{item.slug}</div>
          {metadataKeys.map((k) => (
            <div key={k} className="text-[11px] text-ink-soft font-sans">
              {item.metadata[k] ?? ''}
            </div>
          ))}
          {hasActions && (
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="p-1 text-ink-muted hover:text-ink transition-colors"
                  aria-label={`Edit ${item.name}`}
                >
                  <Pencil className="w-3 h-3" strokeWidth={1.5} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="p-1 text-ink-muted hover:text-destructive transition-colors"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
