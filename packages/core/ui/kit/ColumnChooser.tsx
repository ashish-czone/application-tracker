import { type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, Columns3 } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ColumnChooserItem {
  key: string;
  label: ReactNode;
  /** Columns marked required cannot be hidden. */
  required?: boolean;
}

export interface ColumnChooserProps {
  columns: ColumnChooserItem[];
  /** Currently visible column keys. */
  visible: string[];
  onChange: (next: string[]) => void;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * A gear-style popover listing all columns with checkboxes. Required columns
 * are rendered disabled-but-checked. Consumers pass visible keys and receive
 * the next array on change. Static — no reordering yet.
 */
export function ColumnChooser({
  columns,
  visible,
  onChange,
  align = 'end',
  className,
}: ColumnChooserProps) {
  const toggle = (key: string) => {
    if (visible.includes(key)) {
      onChange(visible.filter((k) => k !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  const showAll = () => onChange(columns.map((c) => c.key));

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-[5px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-ink-soft bg-paper-raised hover:border-ink hover:text-ink transition-colors',
            className,
          )}
          aria-label="Choose columns"
        >
          <Columns3 className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Columns</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="z-50 w-56 bg-paper-raised border border-ink shadow-[4px_4px_0_0_rgba(0,0,0,0.08)] focus:outline-none"
        >
          <div className="border-b border-rule px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-sans">
              Columns
            </span>
            <button
              type="button"
              onClick={showAll}
              className="text-[10px] uppercase tracking-eyebrow text-ink-muted hover:text-signal underline-offset-4 hover:underline font-sans"
            >
              Show all
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {columns.map((col) => {
              const checked = col.required || visible.includes(col.key);
              return (
                <li key={col.key}>
                  <button
                    type="button"
                    disabled={col.required}
                    onClick={() => toggle(col.key)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm font-sans text-ink transition-colors',
                      col.required
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:bg-paper-sunken/60',
                    )}
                  >
                    <span
                      className={cn(
                        'w-3.5 h-3.5 flex-none border flex items-center justify-center',
                        checked ? 'bg-ink border-ink' : 'border-rule',
                      )}
                    >
                      {checked && <Check className="w-3 h-3 text-paper-raised" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate">{col.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
