import { useMemo } from 'react';
import type { GlobalSetItem } from '../data/globalSetsMock';

export interface FlatRowsProps {
  items: GlobalSetItem[];
}

export function FlatRows({ items }: FlatRowsProps) {
  const metadataKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((it) => {
      if (it.metadata) Object.keys(it.metadata).forEach((k) => keys.add(k));
    });
    return Array.from(keys);
  }, [items]);

  return (
    <>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid items-center gap-3 px-4 py-2.5 border-b border-rule hover:bg-paper transition-colors"
          style={{
            gridTemplateColumns: `1fr 120px ${metadataKeys.map(() => '1fr').join(' ') || '0fr'}`,
          }}
        >
          <div className="text-xs text-ink font-sans">{item.label}</div>
          <div className="font-mono text-[11px] text-ink-muted tabular-nums">{item.slug}</div>
          {metadataKeys.map((k) => (
            <div key={k} className="text-[11px] text-ink-soft font-sans">
              {item.metadata?.[k] ?? ''}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
