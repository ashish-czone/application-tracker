import { useEffect, useState, type ReactNode } from 'react';
import { Command } from 'cmdk';
import { cn } from '../../lib/utils';
import { Eyebrow } from '../layout/Eyebrow';

export interface CommandItem {
  id: string;
  label: ReactNode;
  /** Mono "hint" shown on the right — keyboard shortcut, ID. */
  hint?: string;
  icon?: ReactNode;
  onSelect?: () => void;
}

export interface CommandGroup {
  id: string;
  heading: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  placeholder?: string;
  /** Render inline (no modal) — used in the demo page for preview. */
  inline?: boolean;
}

/**
 * ⌘K command palette. Editorial styling: serif italic empty state, small-caps
 * group headings, mono shortcut hints. Wraps cmdk. Can render inline for
 * design previews or as an overlay modal for real use.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = 'Type a command or search…',
  inline = false,
}: CommandPaletteProps) {
  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, inline]);

  const body = (
    <Command
      className={cn(
        'w-full bg-paper-raised border border-rule shadow-[0_12px_40px_-8px_rgba(26,29,33,0.18)]',
        inline ? '' : 'max-w-xl',
      )}
      loop
    >
      <div className="border-b border-rule px-4 py-3">
        <Command.Input
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-base text-ink placeholder:text-ink-muted font-sans"
        />
      </div>
      <Command.List className="max-h-[420px] overflow-y-auto">
        <Command.Empty className="py-8 px-4 text-center">
          <span className="font-serif italic text-ink-soft text-base">
            No matches. Try another phrase.
          </span>
        </Command.Empty>
        {groups.map((group) => (
          <Command.Group
            key={group.id}
            heading={
              <span className="px-4 pt-4 pb-2 block">
                <Eyebrow tone="muted">{group.heading}</Eyebrow>
              </span>
            }
          >
            {group.items.map((item) => (
              <Command.Item
                key={item.id}
                value={`${group.heading}-${item.id}-${typeof item.label === 'string' ? item.label : ''}`}
                onSelect={item.onSelect}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer data-[selected=true]:bg-paper-sunken/70 data-[selected=true]:border-l-2 data-[selected=true]:border-l-authority"
              >
                {item.icon && <span className="text-ink-muted flex-none w-4 h-4">{item.icon}</span>}
                <span className="flex-1 text-sm text-ink font-sans">{item.label}</span>
                {item.hint && (
                  <span className="text-[11px] font-mono tabular-nums text-ink-muted">
                    {item.hint}
                  </span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
      <div className="border-t border-rule px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-medium">
          Compliance Console
        </span>
        <span className="text-[10px] uppercase tracking-eyebrow text-ink-muted font-medium">
          <span className="font-mono normal-case">↑↓</span> Navigate{' '}
          <span className="font-mono normal-case ml-2">↵</span> Select{' '}
          <span className="font-mono normal-case ml-2">esc</span> Close
        </span>
      </div>
    </Command>
  );

  if (inline) return <div className="w-full max-w-xl">{body}</div>;

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4 bg-ink/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      {body}
    </div>
  );
}
